# Contributing to MemoraX Code

Thank you for helping improve MemoraX Code. Keep changes focused, preserve
client-native behavior, and verify the smallest contract affected by the
change.

## Development Setup

Source development requires:

- Git
- Node.js 24 and npm
- Python 3
- `make` on macOS/Linux or PowerShell 7+ on Windows for platform scripts

Start from a clean checkout and install the Backend dependencies:

```bash
git status --short --branch
npm ci --prefix packages/ts/memorax-code-backend
```

Do not commit credentials, `.env.local`, local client transcripts, MemoraX
content, generated trace data, package staging, or machine-specific paths.
Use isolated MemoraX Code state and all affected client homes for lifecycle,
install, migration, or destructive tests. Follow the environment-isolation
rules in [Verification](AGENTS.md#5-verification).

## Repository Ownership

The Backend is a local memory and lifecycle service, not a model-provider
proxy. Clients own models, provider credentials, tool execution, and native
conversation data. Use the architecture's
[package ownership map](ARCHITECTURE.md#21-repository-components) to choose the
owning package and its
[capability map](ARCHITECTURE.md#43-capability-ownership) to place Backend
implementation. Shared orchestration stays separate from native client
interpretation and deployment.

## Making a Change

1. Inspect the current branch, worktree, nearby implementation, and tests.
2. Keep behavior changes separate from unrelated formatting, renaming, or
   dependency updates.
3. Add or update the closest test for a changed contract.
4. Update the detailed source identified in
   [Documentation Ownership](#documentation-ownership), then any affected
   entrypoint summaries or links.
5. Run focused checks first, then broaden validation when the change crosses
   package or lifecycle boundaries.

## Documentation Ownership

Each kind of information has one detailed home. Other documents should provide
the summary or link their readers need. README must remain a self-contained
guide to ordinary installation and first use: do not replace essential
onboarding steps with links solely to avoid duplication. Advanced procedures,
detailed recovery, and implementation contracts belong in their owning guides.
Current source and executable tests remain authoritative for behavior.

| Document | Owns | Update when |
| --- | --- | --- |
| [README](README.md) and [Chinese README](README.zh.md) | Product overview, supported-client entry, requirements, ordinary installation, account or guest setup, required client activation, success verification, first-use walkthrough, and navigation | Entry information or ordinary onboarding changes; keep both languages synchronized. Detailed configuration, recovery, or internal requirements alone do not require a README edit. |
| [npm README](packages/npm/memorax-code/README.md) | A standalone npm entrypoint and links to the detailed guides | The published package's quick start or navigation changes |
| [Installation](INSTALL.md) | Complete installation, setup, upgrade, and removal reference, including client activation and advanced or special-environment procedures | A user must perform different setup or lifecycle steps |
| [Configuration](docs/configuration.md) | Settings, defaults, paths, selection and update semantics | Configuration meaning or runtime configuration behavior changes |
| [Troubleshooting](docs/troubleshooting.md) | Symptoms, diagnosis, and recovery steps | A diagnosis or recovery procedure changes |
| [Architecture](ARCHITECTURE.md) | Package and capability ownership, runtime flows, authority, dependencies, packaging boundaries, and test placement | A documented boundary changes; use its [maintenance criteria](ARCHITECTURE.md#9-maintaining-this-document) |
| [Agent guide](AGENTS.md) | Coding-agent rules, invariants, the complete verification profiles, and Git handoff | Working rules or verification requirements change |
| [Contributor guide](CONTRIBUTING.md) | Human contributor workflow, documentation routing, and the harness onboarding checklist | The contribution or onboarding workflow changes |
| [Security policy](SECURITY.md) | Vulnerability reporting, trust policy, and data-protection guarantees | A security or trust boundary changes; implementation maps link to this policy |
| [Changelog](CHANGELOG.md) | Notable user-facing release changes | Recording a release or its pending notes; internal-only refactors and tests normally do not need an entry |
| [Canonical shared Skill](packages/ts/memorax-code-codex-adapter/skills/memorax-code/SKILL.md) and its references | Product instructions consumed by coding clients | Agent-facing product behavior changes; preserve shared materialization and keep maintainer runbooks out of the Skill |

Keep detailed settings in Configuration and troubleshooting procedures in
Troubleshooting even when Installation links to them. Preserve existing links
and heading anchors when reorganizing a document. The `docs/` pages included
in the npm artifact are declared by
[shipped-docs.json](packages/npm/memorax-code/shipped-docs.json); update its
registration and the documentation checks if shipped paths change.

## Adding a Harness

Use the existing contracts below as the integration checklist. Extend the
closest suite with synthetic native fixtures; keep client-specific authority
and recovery cases in that client's tests.

1. **Establish native authority.** Identify start/completion events, exact
   Session and Turn correlation, workspace evidence, content storage or SDK
   records, interruption, and restart recovery. Implement native interpretation
   under `src/clients/<client>` and use
   [HarnessMemoryRuntime](packages/ts/memorax-code-backend/src/memory/harness-runtime.ts)
   for common memory orchestration. Preserve client-qualified identity and
   fail closed when the required authority is unavailable.
2. **Connect the command boundary.** Extend the versioned client command
   schema and [HTTP contract cases](packages/ts/memorax-code-backend/test/transport/http/memory-hook.test.mjs).
   Verify exact content, missing or conflicting identity, repeated completion,
   interruption, and scope pinning in `test/clients/<client>`. Shared
   [Turn coordinator](packages/ts/memorax-code-backend/test/memory/memory-turn-coordinator.test.mjs)
   and [harness runtime](packages/ts/memorax-code-backend/test/memory/harness-runtime.test.mjs)
   tests already cover their common invariants; retain native fixtures for
   each client's parser and bridge.
3. **Implement lifecycle and reports.** Add an
   [AdapterLifecycleParticipant](packages/ts/memorax-code-backend/src/lifecycle/participant.ts),
   register report identity in
   [client-reports](packages/ts/memorax-code-backend/src/lifecycle/client-reports.ts),
   and verify readiness and summaries in the
   [report contract tests](packages/ts/memorax-code-backend/test/lifecycle/client-reports.test.mjs)
   alongside the existing lifecycle tests.
   Explicitly handle client discovery, persisted selection, activation,
   disablement, and removal in their owning layers; catalog registration alone
   does not enable a client. Preserve user-owned configuration, native locks,
   and public report compatibility.
4. **Ship the actual runtime.** Declare adapter sources and canonical Skill
   materialization in [npm source mapping](scripts/npm-source-files.mjs).
   Check artifact requirements in [package building](scripts/build-npm-packages.mjs),
   [packed-file validation](scripts/validate-npm-pack-json.mjs), and
   [installed-package checks](scripts/npm-package-check.sh). Run the adapter's
   tests against its deployed layout as appropriate; do not maintain a new
   independent Skill copy. The
   [harness coverage check](packages/npm/memorax-code/test/harness-coverage.test.mjs)
   discovers adapter packages and checks Backend client-directory alignment,
   runtime source mappings, canonical Skill materialization, and adapter test
   reachability from `make test`.
5. **Complete the existing gates.** Update
   [source boundaries](packages/ts/memorax-code-backend/test/architecture/source-boundaries.test.mjs)
   for new native readers and intentional dependencies. Runtime discovery
   requires each native client directory to use the shared harness runtime.
   Register new network-capable modules with the
   [local-only trace gate](scripts/check-local-trace-only.mjs). Its source and
   staged scans recognize every adapter's `src`, `hooks`, `runtime-hooks`,
   `scripts`, and shared Skill scripts; a new runtime directory convention
   requires updating the scan and source-mapping checks. Add the adapter
   suite to the repository and platform checks, update architecture and public
   client documentation, and run the relevant
   [verification profiles](AGENTS.md#5-verification).

### Harness Coverage Map

The [native authority map](ARCHITECTURE.md#native-writeback-authority) lists
each harness's content authority and links to its Backend and adapter suites.
Every harness also participates in the shared runtime, lifecycle catalog, npm
source-mapping, test-entry, and local-only trace checks above. This is coverage
of executable contracts, not a record of real-client E2E results.

These checks catch omitted integration wiring. They do not infer native
content authority or replace parser, interruption, lifecycle, installed-package,
or platform verification. Keep new behavior cases in the owning suites.

## Validation

Choose checks by impact from the complete
[verification profiles](AGENTS.md#5-verification). For architecture changes,
the [change-routing table](ARCHITECTURE.md#8-test-architecture-and-change-routing)
maps the affected boundary to its owning tests and named profiles. Documentation
edits also require the Documentation profile; CLI, lifecycle, and artifact
changes require the Install/artifacts profile in addition to affected suites.

Real-client or MemoraX-backed checks must be explicit opt-in tests with
redacted output. Public fixtures must never contain real API keys, private
transcripts, personal memory, or internal infrastructure credentials.

## Pull Requests

A pull request should:

- explain the behavior or invariant being changed;
- keep its diff limited to that purpose;
- list tests run and any meaningful checks not run;
- call out client, workspace/session scope, HTTP/state, packaging, and
  compatibility impact where relevant;
- describe security or data-handling changes explicitly; and
- keep entrypoint summaries and translations consistent with the owning
  documents.

Reviewers prioritize correctness, safety, compatibility, and executable
contracts over stylistic preferences. If you discover a vulnerability, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.
