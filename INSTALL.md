# Install MemoraX Code

The public MemoraX Code release is distributed as one platform-neutral npm
package for macOS, Linux, and Windows. This guide covers the installation,
activation, verification, update, and uninstall workflows. See
[Configuration](docs/configuration.md) for settings and runtime state, or
[Troubleshooting](docs/troubleshooting.md) for recovery steps.
For a source checkout and contributor setup, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

- Node.js 20 or newer (Node.js 24 LTS recommended) and npm.
- At least one of Codex, Claude Code, CodeBuddy/WorkBuddy, DeepSeek Harness
  (DSH), OpenCode Desktop or CLI, or Trae available in the environment where
  MemoraX Code will run. Each client retains its own runtime requirements.
- For DSH, current releases require Node.js `^22.19.0 || >=24.0.0`. Install DSH
  globally or initialize it through its official `npx` workflow first;
  MemoraX Code does not install or update it. Integration requires at least one
  existing Profile and `pnpm` on `PATH` because DSH's native Profile plugin
  manager delegates package changes to it. The tested DSH baseline is
  `0.1.0-rc.6`; other valid semantic versions are reported as untested rather
  than rejected automatically.
- On Linux, `/usr/bin/secret-tool` from libsecret and an available Secret
  Service in the current user session for setup-managed credentials.

MemoraX-backed search, retrieval, and writeback require network access.
Connecting a MemoraX account is recommended. A 90-day account-free guest mode
is also available if you want to try MemoraX Code before creating an account.

For Remote SSH, WSL, or Dev Container use, install MemoraX Code inside the same
remote environment as the client runtime.

## 1. Install the Package

```bash
npm install -g @memorax/memorax-code
```

This command installs or replaces package files. It does not run interactive
setup, ask for credentials, authorize Hooks, or start a fresh installation.
When replacing a running managed Backend, npm lifecycle scripts briefly stop
it, install the new package, and restore it with the retained client selection.
An installation that was already stopped remains stopped.

Do not use `--ignore-scripts` for a normal install or update. It skips the
safe retirement and restoration of a running managed Backend.

If Windows cannot find an installed command, follow the
[Windows PATH repair steps](docs/troubleshooting.md#windows-memorax-code-or-memorax-cli-is-not-found).
Both `memorax-code` and `memorax-cli` are included in this package.

## 2. Connect a MemoraX Account (Recommended)

[Create a MemoraX account](https://platform.memorax.net/) or use an existing
one, then run this command from a normal interactive terminal:

```bash
memorax-code setup --existing-account
```

This mode asks for the username used by the existing MemoraX Code connection
and accepts the API key through masked local terminal input. Never paste an API
key into a chat, repository, screenshot, or public issue.

For another device already using MemoraX Code, find the username and API key in
its private configuration file (normally `~/.memorax-code/config.toml`), then
enter them locally during setup on the new device. Keep that file private.

### Or Try Without an Account (90-Day Guest Mode)

To start immediately and connect an account later, run:

```bash
memorax-code setup
```

Default setup automatically reuses a complete existing configuration. If no
ready connection exists, it detects the local username and preferred language,
asks only when either value cannot be detected safely, and creates or restores
an account-free credential. The resulting API key is written to the private
configuration together with the selected memory preferences.

To activate your guest account, first run this command directly in your local
terminal:

```bash
memorax-code account --show-mark-id
```

After obtaining the Mark ID, create your MemoraX account. The platform does
not currently support attaching a Mark ID to an account that has already been
registered.

Use `memorax-code setup --reconfigure` to replace an automatically reusable
connection and re-detect its preferences. Setup detects supported clients,
installs or refreshes their integrations, starts the local Backend, verifies
status, and records completion only after the final checks succeed.

Running `memorax-code` with no command shows status after setup is complete.
For an older installation with a complete configuration but no completion
record, an interactive invocation runs the one-time setup migration;
otherwise it points to `memorax-code setup`. See
[setup-completion behavior](docs/configuration.md#setup-automatic-update-and-package-transition-state).
Setup requires an interactive terminal and exits without recording completion
when stdin or stderr is detached or redirected.

During setup, MemoraX Code explains that automatic writeback from trusted
workspace sessions sends selected user prompts and matching final assistant
answers to MemoraX for extraction and storage. New configuration enables
automatic writeback, leaves automatic retrieval disabled, and enables
content-bearing local client traces. Review [SECURITY.md](SECURITY.md) for the
network, local-data, credential-storage, and retention boundaries.

MemoraX Code does not read or change the clients' model-provider URL,
credentials, model, or login mode.

## 3. Finish Client Setup

After the first installation, restart or refresh every detected client before
opening a new MemoraX Code session.

| Client | Complete activation |
| --- | --- |
| Codex | Enable **MemoraX Code Codex Adapter** from Plugins or `/plugins` if it is not already enabled. |
| Claude Code | Setup registers the managed marketplace plugin and Hooks. Restart or refresh the client to load them. |
| CodeBuddy/WorkBuddy | Setup registers the managed marketplace plugin, Hooks, and Skill. Restart or refresh WorkBuddy to load them. The lifecycle client ID is `codebuddy`. |
| DeepSeek Harness | Setup registers the integration in existing Profiles. Restart or refresh DSH to load it. Existing Profiles and session data are retained. |
| OpenCode | Restart or refresh OpenCode to load the managed plugin and Skill through auto-discovery. |
| Trae | In **Settings → Hooks → Global → Configured Hooks**, enable the registered Global Hooks once. Setup installs the Hooks and Skill, but the Global Hooks switch requires manual activation. |

If an agent performs installation, it should remind the user to complete the
Trae activation step. It must not report that step as complete based only on
successful setup.

For custom client homes, see the
[integration path settings](docs/configuration.md). If DSH is reported as
degraded, other detected clients and the Backend can still run; follow the
[DSH recovery steps](docs/troubleshooting.md#deepseek-harness-profile-integration-is-inactive).

Open each client in a real project directory, start a new session, and submit
at least one prompt before final verification. A configured integration may
report `hook-runtime=unverified` until a real Hook event changes it to
`observed`; workspace capture can also need attention before that first event.

## 4. Verify the Installation

Run the common checks:

```bash
memorax-code --version
memorax-code status
memorax-cli status
```

In Windows PowerShell, use `memorax-cli.cmd status`.

Check the clients you installed:

| Client | Diagnostic command |
| --- | --- |
| Codex | `memorax-code-codex doctor` |
| Claude Code | `memorax-code-claude doctor` |
| CodeBuddy/WorkBuddy | `memorax-code-codebuddy status --json` |
| DeepSeek Harness | `memorax-code status --clients dsh` |
| OpenCode | `memorax-code-opencode doctor` |
| Trae | `memorax-code-trae status --json` |

`memorax-code status` checks the local Backend and every selected client
integration. `memorax-cli status` checks whether the local MemoraX
configuration, workspace scope, and memory switches resolve without printing
the API key. It does not send a test
request to MemoraX; the first real search or write verifies remote connectivity
and credentials.

## Incomplete Setup

Package installation can succeed while setup remains incomplete. Resume or
repair it from an interactive terminal:

```bash
memorax-code setup
memorax-code status
memorax-cli status
```

Default setup reuses a complete retained connection. Use
`memorax-code setup --reconfigure` to replace it, or
`memorax-code setup --existing-account` to enter an existing account.

See [Configuration](docs/configuration.md) for the supported fields and
environment variables.

## Update

Update through the product command so the installed release channel, managed
home, client selection, and lifecycle hooks are handled consistently:

```bash
memorax-code update
```

For a custom state root, pass its absolute path explicitly:

```bash
memorax-code update --home /absolute/path/to/memorax-code-home
```

The updater uses the standard npm install command. If the managed Backend is
running, package replacement briefly stops it, starts the new version with the
retained client selection, and verifies status. A stopped installation remains
stopped.

After setup has completed, the managed Backend also checks for updates while
running. Stable packages follow npm `latest`; prerelease packages follow
`preview`. Set `MEMORAX_CODE_AUTO_UPDATE=false` before starting or restarting
the managed Backend to disable background checks. See
[automatic update settings and state](docs/configuration.md#setup-automatic-update-and-package-transition-state)
for scheduling, reconciliation, and Codex Hook verification details.

Automatic reconciliation preserves explicit `true` and `false` client choices,
the MemoraX connection, and memory configuration. It enables a detected client
whose key is missing from an older configuration; an explicit `false` remains
disabled. See [client selection](docs/configuration.md#client-selection) for
the complete selection rules.

A manual interactive `memorax-code update` may still offer newly available
clients, but verified Codex Hook changes no longer require confirmation.
Without a completed setup, or in a non-interactive manual update, package
replacement can still complete and the updater tells you to run
`memorax-code setup` explicitly. Direct npm updates perform only package
replacement and do not run product reconciliation.

Restart or refresh clients when an update changes their loaded integration
assets, then repeat [installation verification](#4-verify-the-installation).
For an `EBUSY` error when upgrading older Windows installations, follow the
[package transition recovery](docs/troubleshooting.md#npm-package-transition-fails).

## Uninstall

Run the product lifecycle before removing package files:

```bash
memorax-code uninstall
```

Do not start with `npm uninstall -g`. npm does not provide MemoraX Code with an
uninstall lifecycle in which to remove managed client integrations and stop
the Backend.
The product command removes the managed integrations and global package while
retaining `$MEMORAX_CODE_HOME` configuration and local traces, Claude plugin
data, DSH Profiles and session data, client provider configuration, secure
account-free credentials, and memories stored in MemoraX. Review and remove
retained local or cloud data separately only when it is no longer needed.

A complete product uninstall clears the setup-completion marker but preserves
the retained configuration. After reinstalling, run `memorax-code setup`;
default setup reuses a complete retained connection automatically. A normal
`memorax-code stop` and a partial client uninstall preserve setup completion.

## Troubleshooting

Use the [verification commands](#4-verify-the-installation) above to identify
the failing component. See [Troubleshooting](docs/troubleshooting.md) for
recovery steps and safe issue reporting guidance.
