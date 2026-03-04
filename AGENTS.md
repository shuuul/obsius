# Obsius - LLM Developer Guide

**Generated:** 2026-03-04 | **Branch:** master

## Overview
Obsidian desktop plugin for AI chat (OpenCode, Claude Code, Codex, Gemini CLI, custom agents). React 19 + TypeScript, communicating via Agent Client Protocol (ACP) over JSON-RPC stdin/stdout. Multi-tab chat sessions in a sidebar view.

## Structure
```
src/
├── main.ts                   # Re-exports plugin.ts
├── plugin.ts                 # Obsidian plugin lifecycle, owns `AgentRuntimeManager`
├── plugin/                   # Extracted plugin modules
├── domain/                   # Pure types + interfaces — ZERO external deps
│   ├── models/               # ChatMessage, SessionUpdate, AgentConfig, terminal output, etc.
│   └── ports/                # IAgentClient, IVaultAccess, ISettingsAccess, IChatViewContainer
├── adapters/
│   ├── acp/                  # ACP protocol bridge + runtime/process/terminal modules
│   └── obsidian/             # VaultAdapter, SettingsStore, MentionService, SecretStorage adapter
├── application/
│   ├── services/             # chat-view registry + session restore services
│   └── use-cases/            # prompt preparation/sending use case
├── hooks/                    # React custom hooks + reducer-backed state modules
│   ├── state/                # Typed reducers + action creators
│   ├── chat-controller/      # Controller types, effects, history handlers
│   ├── agent-session/        # Session lifecycle, helpers, types
│   ├── chat/                 # Message updaters (extracted from useChat)
│   └── session-history/      # History ops + types
├── components/
│   ├── chat/
│   ├── picker/
│   └── settings/
└── shared/                   # Pure/stateless utility helpers only
```

## Where To Look
| Task | Location | Notes |
|------|----------|-------|
| Add new feature | `hooks/use[Feature].ts` → compose in `useChatController.ts` | See `hooks/AGENTS.md` |
| Add agent type | Implement `IAgentClient` in `adapters/[agent]/` | Domain port isolates protocol |
| Modify message types | `domain/models/chat-message.ts` + `session-update.ts` | Then handle in `useChat.handleSessionUpdate()` |
| Change ACP protocol | `adapters/acp/` modules + `acp.adapter.ts` composition | See `adapters/acp/AGENTS.md` |
| UI changes | `components/chat/` | See `components/chat/AGENTS.md` |
| Settings changes | `plugin.ts` (interface) + `components/settings/sections/` (UI sections) | `AgentClientSettingTab.ts` is thin coordinator |
| Add picker provider | `components/picker/` | Implement provider matching `PickerProvider` type |
| Add input UI element | `components/chat/chat-input/` | 14 files: RichTextarea, InputActions, SelectorButton, ContextUsageMeter, etc. |
| Inline edit | `plugin/inline-edit.ts` | Selection → agent prompt with diff viewer |
| Tab management | `hooks/useTabs.ts` + `components/chat/TabBar.tsx` + `TabContent.tsx` | Multi-tab chat sessions |
| Editor context menus | `plugin/editor-context.ts` | Selection, file, folder context references |
| Debug | Settings → Debug Mode ON → DevTools → filter `[AcpAdapter]`, `[useChat]`, `[NoteMentionService]` | |

## Architecture: Distributed Hook Composition

```
ChatView.tsx (ChatComponent)
    ├── useTabs()             → multi-tab management (max 4 tabs)
    ├── useUpdateCheck()      → GitHub release update check
    ├── useWorkspaceEvents()  → workspace hotkey events
    │
    └── per tab → TabContent.tsx
          ├── useSessionRestore()  → session file restoration from disk
          ├── useChatController()  ← Central coordinator (10 hooks)
          │     ├── Gets dependencies from plugin factory:
          │     │   └── plugin.createChatSessionDependencies()
          │     └── Composes hooks:
          │           ├── useSettings()          → useSyncExternalStore subscription
          │           ├── useAgentSession()      → session lifecycle, agent switching
          │           ├── useChat()              → messages, streaming, tool calls
          │           ├── usePermission()        → permission request handling
          │           ├── useMentions()          → @[[note]] suggestions
          │           ├── useSlashCommands()     → /command suggestions + token handling
          │           ├── useAutoMention()       → active note tracking
          │           ├── useModelFiltering()    → model search/filter state
          │           ├── useSessionHistory()    → session list, load, resume, fork
          │           └── useSessionHistoryHandlers() → history popover orchestration
          │
          └── ChatInput.tsx
                ├── usePicker()        → unified picker panel (mentions)
                ├── usePicker()        → unified picker panel (commands)
                └── useInputHistory()  → input history navigation
```

## Data Flow
```
User input → ChatInput → useChatController.handleSendMessage()
  → useChat.sendMessage() → preparePrompt() (application/use-cases/prompt/prompt-preparation.ts)
    → sendPreparedPrompt() → agentClient.sendPrompt() → ACP JSON-RPC → agent process

Agent response → AcpAdapter.sessionUpdate() → onSessionUpdate callback
  → useChatController routes to:
    → useChat.handleSessionUpdate() (message chunks, tool calls, plans)
    → useAgentSession (available_commands_update, current_mode_update)
  → setMessages() → React re-render

Context references → editor-context.ts → addContextToCurrentChat()
  → ChatViewRegistry.toFocused() → IChatViewContainer.addContextReference()
    → chat-context-token.ts → inline tokens in message text
```

## Conventions

### Architecture Rules
1. **Hooks own state + logic** — no ViewModel/UseCase classes
2. **Pure functions in shared/** — non-React stateless utility logic only
3. **Domain has ZERO deps** — no `obsidian`, no `@agentclientprotocol/sdk` imports in `domain/`
4. **Ports isolate protocol** — `IAgentClient` interface means ACP changes stay in `adapters/acp/`
5. **Unified callbacks** — single `onSessionUpdate` for all agent events, not multiple callbacks
6. **Upsert pattern** — functional `setMessages((prev) => ...)` to avoid race conditions with streaming tool_call_update events
7. **Reducer-backed state** — `hooks/state/` modules for deterministic transitions in `useChat`/`useAgentSession`/`usePermission`

### Dependency Boundary Rules (CRITICAL — Enforced by Architecture)

This project uses a **hexagonal (ports & adapters) architecture**. The dependency flow is strictly one-directional:

```
components/ ──→ domain/ports/    ←── adapters/
hooks/      ──→ domain/models/   ←── adapters/
                     ↑
             application/ (use-cases, services)
```

**Hard rules — violations MUST be rejected in code review:**

| From | May Import | MUST NOT Import |
|------|-----------|----------------|
| `components/` | `domain/ports/`, `domain/models/`, `shared/` (pure utils only) | `adapters/` ❌ |
| `hooks/` | `domain/ports/`, `domain/models/`, `shared/`, `application/` | `adapters/` ❌ |
| `application/` | `domain/ports/`, `domain/models/`, `shared/` | `adapters/` ❌, `components/` ❌, `hooks/` ❌ |
| `shared/` | `domain/models/` (types only) | `adapters/` ❌, `hooks/` ❌, `components/` ❌ |
| `domain/` | Nothing external | Everything ❌ (zero-dep) |
| `adapters/` | `domain/ports/`, `domain/models/`, `shared/`, external SDKs | `components/` ❌, `hooks/` ❌ |

**Verification command:**
```bash
# MUST return 0 results — run before every commit
grep -rn 'from.*adapters/' src/components/ src/hooks/ src/application/ 2>/dev/null | grep -v AGENTS.md
```

**Why this matters for LLM-assisted coding:** LLMs lack persistent awareness of the global dependency graph. Without these boundaries, they will take the shortest path (e.g., importing `AcpAdapter` directly in a component) which introduces coupling that makes future changes exponentially harder. The Port interfaces act as **cognitive firewalls** — when an LLM modifies UI or hook logic, it can only "see" the abstract Port signatures, physically preventing it from generating protocol-specific code in the wrong layer.

### State Management Rules

1. **Session state is an enum** — `SessionState` in `domain/models/chat-session.ts` defines the canonical phases: `initializing | authenticating | ready | busy | error | disconnected`
2. **State changes go through reducers** — use typed actions in `hooks/state/`, never raw `setState` for session phase changes
3. **Derive, don't store** — boolean flags like `isReady` must be derived from the enum state (`session.state === "ready"`), not stored as separate state
4. **No boolean flag combinations** — if you need to represent a new operational phase (e.g., "loading history"), add it to the `SessionState` enum rather than introducing a new `isLoadingX` boolean
5. **Exhaustive switch** — all reducers must use `never` exhaustive check in default case

### Obsidian Plugin Rules (CRITICAL)
1. **No innerHTML/outerHTML** — use `createEl`/`createDiv`/`createSpan`
2. **NO detach leaves in onunload** — this is an antipattern
3. **Styles in CSS only** — no JS style manipulation (except font size CSS var and ProviderLogo mask-image)
4. **Use `Platform.isWin/isMacOS/isLinux`** — never `process.platform`
5. **Minimize `any`** — use proper types
6. **Desktop only** — `ChatView` throws if `!Platform.isDesktopApp`

### Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Ports | `*.port.ts` | `agent-client.port.ts` |
| Adapters | `*.adapter.ts` | `acp.adapter.ts` |
| Hooks | `use*.ts` (camelCase) | `useChat.ts` |
| Components | `PascalCase.tsx` | `ChatView.tsx` |
| Utils/Models | `kebab-case.ts` | `path-utils.ts` |
| Input hooks | `use-kebab-case.ts` | `use-chat-input-behavior.ts` |

### Formatting
- Tabs (width 4), double quotes, trailing commas, LF line endings
- Biome: `npm run format` / ESLint + architecture guards: `npm run lint`

### Version Synchronization (Release-Critical)
1. **Obsidian UI version source** — Obsidian shows `manifest.json` `version`, not Git tag names.
2. **Keep versions aligned** — `package.json` `version`, `manifest.json` `version`, and latest key in `versions.json` must match.
3. **Tags/releases must match files** — create tag `vX.Y.Z` only after files are bumped to `X.Y.Z`.
4. **Tags alone do not bump files** — pushing `v0.3.2` without bumping files still ships `manifest.json` `0.3.0` to Obsidian.
5. **Pre-push consistency check**:
```bash
node -e 'const pkg=require("./package.json").version;const manifest=require("./manifest.json").version;const keys=Object.keys(require("./versions.json"));const latest=keys[keys.length-1];if(pkg!==manifest||manifest!==latest){console.error(`Version mismatch: package=${pkg}, manifest=${manifest}, versions.latest=${latest}`);process.exit(1)}console.log(`Version OK: ${pkg}`)'
```
6. **Release flow**:
```bash
npm version patch             # or minor/major (updates package.json)
npm run version              # sync manifest.json + versions.json from package version
git add package.json package-lock.json manifest.json versions.json
git commit -m "chore: bump version to vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
```

## Anti-Patterns (This Project)
- **Don't add ViewModel/UseCase classes** — use hooks
- **Don't import obsidian or ACP SDK in domain/** — zero-dep rule
- **Don't use multiple event callbacks** — use unified `onSessionUpdate`
- **Don't mutate messages directly** — always functional `setMessages((prev) => ...)`
- **Don't detach leaves in `onunload`**
- **Don't use `innerHTML`/`outerHTML`**
- **Don't bypass reducers** — use typed actions in `hooks/state/` for state transitions
- **Don't import from `adapters/` in components or hooks** — use `domain/ports/` interfaces instead (see Dependency Boundary Rules)
- **Don't add boolean flags for new operational phases** — extend `SessionState` enum instead
- **Don't put stateful/side-effectful modules in `shared/`** — `shared/` is for pure functions only; modules with I/O, process spawning, or lifecycle management belong in `application/` or `adapters/`
- **Don't expose adapter-specific types in hook return interfaces** — use domain Port types (e.g., `IAgentClient` not `IAcpClient`)

## Commands
```bash
npm run dev              # Vite watch build
npm run typecheck        # TypeScript typecheck only
npm run build            # typecheck + Vite production build
npm run lint             # Biome + ESLint + architecture guardrails
npm run lint:fix         # ESLint auto-fix
npm run test             # Vitest
npm run test:coverage    # Vitest + coverage gates (80% lines/functions, 70% branches)
npm run format           # Biome write
npm run format:check     # Biome check
npm run version          # Bump manifest.json + versions.json
npm run docs:dev         # VitePress dev server

# Architecture boundary check (should return empty)
grep -rn 'from.*adapters/' src/components/ src/hooks/ src/application/ 2>/dev/null | grep -v AGENTS.md
npm run docs:build       # VitePress build
```

## Notes
- **Tests exist**: Vitest with coverage gates (test/ directory, 19 test files + setup + mocks/)
- **CI**: PR workflow enforces typecheck, lint, tests with coverage, plugin build, and docs build
- **Multi-session**: `ChatViewRegistry` manages sidebar views with independent ACP sessions
- **Multi-tab**: `useTabs` hook supports up to 4 concurrent chat tabs per view, each with its own agent/session; new tabs inherit the active tab's agent ID
- **Session history**: Agent-side (`listSessions`) + local persistence (`sessions/{id}.json`)
- **Settings validation**: `settings-schema.ts` uses Zod for runtime validation with schema versioning (v4)
- **Context references**: Editor context menus (selection, file, folder) inject `ChatContextReference` tokens into chat input via `chat-context-token.ts`
- **Picker system**: `components/picker/` provides unified `UnifiedPickerPanel` for @mentions and /commands with pluggable providers
- **Inline edit**: `plugin/inline-edit.ts` enables selection-based editing via agent prompt with diff viewer
- **Session restore**: `useSessionRestore` (thin React wrapper) delegates to `SnapshotManager` in `application/services/session-restore/`; captures original file state on first sighting (from diff `oldText` or disk read), detects changes via disk comparison; `discoverModifiedFiles` scans tool call sources (diffs, rawInput, locations) for file paths
- **Settings migrations**: `settings-migrations.ts` handles schema version upgrades with typed migration functions
- **Slash command tokens**: `slash-command-token.ts` encodes/decodes slash commands as inline tokens in message text
- **Context usage meter**: `ContextUsageMeter.tsx` displays context window usage as a visual meter in the input area
- **Multi-file mentions**: `@[[...]]` mentions now support `.md`, `.canvas`, `.excalidraw`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`; resolved by full path then basename via `mentionable-files.ts`
- **Image prompt support**: `supportsImage` capability flag; image files are read as binary (`IVaultAccess.readBinaryFile`) and attached as `image` prompt content
- **Agent ID safety**: `resolveExistingAgentId` / `resolveTabAgentId` guard against stale/removed agent IDs at session init and tab creation
- **Loading spinner**: SVG square-dots spinner replaces three-dot pulse in `ChatMessages` while `isSending`
- **CollapsibleSection**: New `collapsible` prop — pass `false` for static (non-expandable) tool call headers when no details exist
- **Model preferences**: `components/settings/sections/model-preferences.ts` provides per-agent model preference configuration
- **Current decomposition state**:
  - `src/plugin.ts` is thin orchestrator; helpers in `src/plugin/`
  - `src/adapters/acp/acp.adapter.ts` is a thin entry delegating to `acp.adapter-base.ts` + delegate modules
  - Prompt orchestration moved to `src/application/use-cases/prompt/`
  - Session restore moved to `src/application/services/session-restore/`
- **Shared runtime**: Multiple tabs using the same agent share one ACP process via `AgentRuntimeManager` + `RuntimeMultiplexer`
- **Undocumented API**: `vault.adapter.ts` uses `editor.cm` (CodeMirror 6 internal) for selection tracking
- **ACP SDK**: `@agentclientprotocol/sdk ^0.14.1` — protocol may evolve
- **External deps**: `react ^19.2.0`, `diff ^8.0.2`, `semver ^7.7.3`, `zod ^3.24.1`, `tslib ^2.8.1`, `@codemirror/state 6.5.0`, `@codemirror/view 6.38.6`
- **Provider logos**: `ProviderLogo.tsx` loads SVGs from `@lobehub/icons-static-svg` CDN via CSS mask-image

## Subdirectory Guides
- [`src/hooks/AGENTS.md`](src/hooks/AGENTS.md) — Hook composition, race condition patterns, data flow
- [`src/components/chat/AGENTS.md`](src/components/chat/AGENTS.md) — Component tree, rendering patterns
- [`src/adapters/acp/AGENTS.md`](src/adapters/acp/AGENTS.md) — ACP protocol, process lifecycle, JSON-RPC
- [`src/shared/AGENTS.md`](src/shared/AGENTS.md) — Utility catalog with consumers
- [`src/domain/AGENTS.md`](src/domain/AGENTS.md) — Domain models, ports, zero-dep rule
