export type DefaultWorkspaceOptions = Readonly<{
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  readFile?: (path: string) => string;
  realpath?: (path: string) => string;
  execFile?: typeof import("node:child_process").execFileSync;
}>;

export function resolveWorkBuddyWorkspaceKind(
  input: { cwd?: unknown; workspace_kind?: unknown; workspaceKind?: unknown },
  options?: DefaultWorkspaceOptions,
): string | undefined;

export function isOpenCodeDefaultWorkspace(cwd: string | undefined, options?: DefaultWorkspaceOptions): boolean;
