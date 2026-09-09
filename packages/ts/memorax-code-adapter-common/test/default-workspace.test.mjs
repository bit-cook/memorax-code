import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import test from "node:test";
import { isOpenCodeDefaultWorkspace, resolveWorkBuddyWorkspaceKind } from "../src/default-workspace.mjs";

test("WorkBuddy recognizes only an immediate valid task under the configured native root", async () => {
  const home = await mkdtemp(join(tmpdir(), "memorax-workbuddy-workspace-"));
  const options = { env: { HOME: home, USERPROFILE: home } };
  try {
    const root = join(home, "WorkBuddy");
    const task = join(root, "2026-09-08-12-34-56");
    const invalid = join(root, "2026-02-30-12-34-56");
    const invalidTime = join(root, "2026-09-08-24-00-00");
    const ordinary = join(root, "my-project");
    const outside = join(home, "outside");
    for (const directory of [join(task, "nested"), invalid, invalidTime, ordinary, outside]) await mkdir(directory, { recursive: true });
    assert.equal(resolveWorkBuddyWorkspaceKind({ cwd: task }, options), "projectless");
    for (const cwd of [root, join(task, "nested"), invalid, invalidTime, ordinary, outside, "WorkBuddy/2026-09-08-12-34-56"])
      assert.equal(resolveWorkBuddyWorkspaceKind({ cwd }, options), undefined, cwd);
    const escaped = join(root, "2026-09-08-12-34-57");
    await symlink(outside, escaped, process.platform === "win32" ? "junction" : "dir");
    assert.equal(resolveWorkBuddyWorkspaceKind({ cwd: escaped }, options), undefined);
    assert.equal(resolveWorkBuddyWorkspaceKind({ cwd: task, workspace_kind: "local", workspaceKind: "projectless" }, options), "local");

    const customRoot = join(home, "Custom tasks");
    const customTask = join(customRoot, "2026-09-08-12-34-56");
    const userData = join(home, "native-app");
    const configRoot = join(home, "native-config");
    await mkdir(customTask, { recursive: true });
    await mkdir(userData, { recursive: true });
    await mkdir(join(configRoot, "app"), { recursive: true });
    await writeFile(join(configRoot, "app", "app-config.json"), JSON.stringify({ defaultWorkspacePath: customRoot }));
    const configOptions = { env: { ...options.env, WORKBUDDY_CONFIG_DIR: configRoot } };
    assert.equal(resolveWorkBuddyWorkspaceKind({ cwd: customTask }, configOptions), "projectless");
    assert.equal(resolveWorkBuddyWorkspaceKind({ cwd: task }, configOptions), undefined);
    await writeFile(join(userData, "app-config.json"), "invalid json");
    const userDataOptions = { env: { ...configOptions.env, WORKBUDDY_USER_DATA_DIR: userData } };
    assert.equal(resolveWorkBuddyWorkspaceKind({ cwd: customTask }, userDataOptions), undefined);
    await writeFile(join(userData, "app-config.json"), JSON.stringify({ defaultWorkspacePath: customRoot }));
    assert.equal(resolveWorkBuddyWorkspaceKind({ cwd: customTask }, userDataOptions), "projectless");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("OpenCode follows redirected Documents but rejects nested projects and escaping project links", async () => {
  const home = await mkdtemp(join(tmpdir(), "memorax-opencode-documents-"));
  try {
    const documents = join(home, "redirected-documents");
    const project = join(documents, "Default Project");
    await mkdir(join(project, "nested"), { recursive: true });
    await symlink(documents, join(home, "Documents"), process.platform === "win32" ? "junction" : "dir");
    const options = {
      env: { HOME: home, USERPROFILE: home, SystemRoot: "C:\\Windows" },
      execFile: () => `${join(home, "Documents")}\r\n`,
    };
    assert.equal(isOpenCodeDefaultWorkspace(join(home, "Documents", "Default Project"), options), true);
    assert.equal(isOpenCodeDefaultWorkspace(join(project, "nested"), options), false);
    assert.equal(isOpenCodeDefaultWorkspace(documents, options), false);
    await rm(project, { recursive: true });
    const outside = join(home, "ordinary-project");
    await mkdir(outside);
    await symlink(outside, project, process.platform === "win32" ? "junction" : "dir");
    assert.equal(isOpenCodeDefaultWorkspace(project, options), false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Linux Documents reads XDG data without evaluating shell expressions or hiding unreadable configuration", () => {
  const base = { platform: "linux", env: { HOME: "/home/test", XDG_CONFIG_HOME: "/custom-config" }, realpath: (path) => path };
  const options = (text) => ({ ...base, readFile: (path) => { assert.equal(path, "/custom-config/user-dirs.dirs"); return text; } });
  assert.equal(isOpenCodeDefaultWorkspace("/home/test/My Documents/Default Project", options('XDG_DOCUMENTS_DIR="$HOME/My Documents"\n')), true);
  assert.equal(isOpenCodeDefaultWorkspace("/mnt/documents/Default Project", options('XDG_DOCUMENTS_DIR="/mnt/documents"\n')), true);
  for (const text of ['XDG_DOCUMENTS_DIR="$(touch /tmp/never-run)"', 'XDG_DOCUMENTS_DIR="$OTHER/documents"', 'XDG_DOCUMENTS_DIR=unquoted'])
    assert.equal(isOpenCodeDefaultWorkspace("/home/test/Documents/Default Project", options(text)), false);
  assert.equal(isOpenCodeDefaultWorkspace("/home/test/Documents/Default Project", { ...base, readFile: () => { throw Object.assign(new Error(), { code: "EACCES" }); } }), false);
});

test("Windows Documents queries the unique system folder in UTF-8 and never guesses after lookup failure", () => {
  const env = { USERPROFILE: "C:\\Users\\Test", SystemRoot: "C:\\Windows", OneDrive: "D:\\Cloud" };
  const base = { platform: "win32", env, realpath: win32.normalize };
  const options = {
    ...base,
    execFile: (executable, args, config) => {
      assert.equal(executable, "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
      assert.deepEqual(args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-Command"]);
      assert.match(args[3], /\[Console\]::OutputEncoding = \[System\.Text\.UTF8Encoding\]::new\(\$false\)/);
      assert.match(args[3], /\[Environment\]::GetFolderPath\('MyDocuments'\)/);
      assert.equal(config.timeout, 1_000);
      assert.equal(config.encoding, "utf8");
      assert.equal(config.shell, undefined);
      return "D:\\云空间\\文档\r\n";
    },
  };
  assert.equal(isOpenCodeDefaultWorkspace("d:/云空间/文档/default project", options), true);
  assert.equal(isOpenCodeDefaultWorkspace("C:\\Users\\Test\\Documents\\Default Project", options), false);
  assert.equal(isOpenCodeDefaultWorkspace("D:\\Cloud\\Documents\\Default Project", options), false);
  assert.equal(isOpenCodeDefaultWorkspace("D:\\云空间\\文档\\Default Project\\nested", options), false);
  let calls = 0;
  const unavailable = { ...base, execFile: () => { calls += 1; throw new Error("folder query timeout"); } };
  assert.equal(isOpenCodeDefaultWorkspace("D:\\Cloud\\Documents\\Default Project", unavailable), false);
  assert.equal(isOpenCodeDefaultWorkspace("C:\\Users\\Test\\Documents\\Default Project", unavailable), false);
  assert.equal(isOpenCodeDefaultWorkspace("E:\\Unrelated\\Documents\\Default Project", unavailable), false);
  const lookups = calls;
  assert.equal(isOpenCodeDefaultWorkspace("D:\\ordinary-project", unavailable), false);
  assert.equal(isOpenCodeDefaultWorkspace("D:\\Cloud\\Documents\\Default Project\\nested", unavailable), false);
  assert.equal(calls, lookups, "ordinary workspaces do not launch a folder lookup");
  assert.equal(resolveWorkBuddyWorkspaceKind({ cwd: "d:/tasks/2026-09-08-12-34-56" }, {
    ...base,
    readFile: () => JSON.stringify({ defaultWorkspacePath: "D:\\Tasks" }),
  }), "projectless");
});
