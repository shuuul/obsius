# Agent Client Plugin - LLM Developer Guide

**Generated:** 2026-03-01 | **Commit:** ee8e386 | **Branch:** master

## Overview
Obsidian desktop plugin for AI agent chat (Claude Code, Codex, Gemini CLI, custom agents). React 19 + TypeScript, communicating via Agent Client Protocol (ACP) over JSON-RPC stdin/stdout.

## Structure
```
src/
├── main.ts                   # Re-exports plugin.ts
├── plugin.ts                 # Obsidian plugin lifecycle, settings, multi-session (1279 lines)
├── domain/                   # Pure types + interfaces — ZERO external deps
│   ├── models/               # ChatMessage, SessionUpdate, AgentConfig, etc. (8 files)
│   └── ports/                # IAgentClient, IVaultAccess, ISettingsAccess, IChatViewContainer (4 files)
├── adapters/
│   ├── acp/                  # ACP protocol: process spawn, JSON-RPC, ndJsonStream (2 files)
│   └── obsidian/             # VaultAdapter, SettingsStore, MentionService (3 files)
├── hooks/                    # React custom hooks — ALL state + logic lives here (11 files)
├── components/
│   ├── chat/                 # ChatView + 22 sub-components (23 files)
│   └── settings/             # AgentClientSettingTab (1 file)
└── shared/                   # Pure utility functions, no React deps (15 files)
```

## Where To Look
| Task | Location | Notes |
|------|----------|-------|
| Add new feature | `hooks/use[Feature].ts` → compose in `useChatController.ts` | See `hooks/AGENTS.md` |
| Add agent type | Implement `IAgentClient` in `adapters/[agent]/` | Domain port isolates protocol |
| Modify message types | `domain/models/chat-message.ts` + `session-update.ts` | Then handle in `useChat.handleSessionUpdate()` |
| Change ACP protocol | `adapters/acp/acp.adapter.ts` only | 1678 lines — see `adapters/acp/AGENTS.md` |
| UI changes | `components/chat/` | See `components/chat/AGENTS.md` |
| Settings changes | `plugin.ts` (interface) + `components/settings/AgentClientSettingTab.ts` (UI) | |
| Debug | Settings → Debug Mode ON → DevTools → filter `[AcpAdapter]`, `[useChat]`, `[NoteMentionService]` | |
| Hot reload | Install [pjeby/hot-reload](https://github.com/pjeby/hot-reload) in vault | Auto-reloads on `npm run dev` build |

## Architecture: Hook Composition Pattern

```
ChatView.tsx / FloatingChatView.tsx
    └── useChatController()  ← Central coordinator (858 lines)
            ├── Creates adapters via useMemo:
            │   ├── AcpAdapter (from plugin registry)
            │   ├── ObsidianVaultAdapter
            │   └── NoteMentionService
            └── Composes 9 hooks:
                ├── useSettings()          → useSyncExternalStore subscription
                ├── useAgentSession()      → session lifecycle, agent switching
                ├── useChat()              → messages, streaming, tool calls
                ├── usePermission()        → permission request handling
                ├── useMentions()          → @[[note]] suggestions
                ├── useSlashCommands()     → /command suggestions
                ├── useAutoMention()       → active note tracking
                ├── useAutoExport()        → markdown export
                └── useSessionHistory()    → session list, load, resume, fork
```

## Data Flow
```
User input → ChatInput → useChatController.handleSendMessage()
  → useChat.sendMessage() → preparePrompt() (shared/message-service.ts)
    → sendPreparedPrompt() → agentClient.sendPrompt() → ACP JSON-RPC → agent process

Agent response → AcpAdapter.sessionUpdate() → onSessionUpdate callback
  → useChatController routes to:
    → useChat.handleSessionUpdate() (message chunks, tool calls, plans)
    → useAgentSession (available_commands_update, current_mode_update)
  → setMessages() → React re-render
```

## Conventions

### Architecture Rules
1. **Hooks own state + logic** — no ViewModel/UseCase classes
2. **Pure functions in shared/** — non-React business logic (e.g., `message-service.ts`)
3. **Domain has ZERO deps** — no `obsidian`, no `@agentclientprotocol/sdk` imports in `domain/`
4. **Ports isolate protocol** — `IAgentClient` interface means ACP changes stay in `adapters/acp/`
5. **Unified callbacks** — single `onSessionUpdate` for all agent events, not multiple callbacks
6. **Upsert pattern** — functional `setMessages((prev) => ...)` to avoid race conditions with streaming tool_call_update events

### Obsidian Plugin Rules (CRITICAL)
1. **No innerHTML/outerHTML** — use `createEl`/`createDiv`/`createSpan`
2. **NO detach leaves in onunload** — this is an antipattern
3. **Styles in CSS only** — no JS style manipulation (except floating window position, font size CSS var)
4. **Use `Platform.isWin/isMacOS/isLinux`** — never `process.platform`
5. **Minimize `any`** — use proper types
6. **Desktop only** — `ChatView` throws if `!Platform.isDesktopApp`

### Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Ports | `*.port.ts` | `agent-client.port.ts` |
| Adapters | `*.adapter.ts` | `acp.adapter.ts` |
| Hooks | `use*.ts` | `useChat.ts` |
| Components | `PascalCase.tsx` | `ChatView.tsx` |
| Utils/Models | `kebab-case.ts` | `message-service.ts` |

### Formatting
- Tabs (width 4), double quotes, trailing commas, LF line endings
- Prettier: `npm run format` / ESLint: `npm run lint`

## Anti-Patterns (This Project)
- **Don't add ViewModel/UseCase classes** — use hooks
- **Don't import obsidian or ACP SDK in domain/** — zero-dep rule
- **Don't use multiple event callbacks** — use unified `onSessionUpdate`
- **Don't mutate messages directly** — always functional `setMessages((prev) => ...)`
- **Don't detach leaves in `onunload`**
- **Don't use `innerHTML`/`outerHTML`**

## Commands
```bash
npm run dev              # esbuild watch mode (outputs main.js)
npm run build            # tsc -noEmit -skipLibCheck && esbuild production
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run version          # Bump manifest.json + versions.json
npm run docs:dev         # VitePress dev server
npm run docs:build       # VitePress build
```

## Notes
- **No tests exist** — no test framework installed, no CI test pipeline
- **CI**: Only docs deploy + event relay workflows; no automated type-check/lint/build on PRs
- **Multi-session**: `ChatViewRegistry` manages sidebar + floating views with independent ACP sessions
- **Session history**: Agent-side (`listSessions`) + local persistence (`sessions/{id}.json`)
- **TODOs in code**: `TODO(code-block)` markers for future code block chat view feature
- **Undocumented API**: `vault.adapter.ts:211` uses `editor.cm` (CodeMirror 6 internal) for selection tracking
- **ACP SDK**: `@agentclientprotocol/sdk ^0.13.1` — protocol may evolve
- **External deps**: `react ^19.1.1`, `diff ^8.0.2`, `semver ^7.7.3`, `@codemirror/state`, `@codemirror/view`

## Subdirectory Guides
- [`src/hooks/AGENTS.md`](src/hooks/AGENTS.md) — Hook composition, race condition patterns, data flow
- [`src/components/chat/AGENTS.md`](src/components/chat/AGENTS.md) — Component tree, rendering patterns
- [`src/adapters/acp/AGENTS.md`](src/adapters/acp/AGENTS.md) — ACP protocol, process lifecycle, JSON-RPC
- [`src/shared/AGENTS.md`](src/shared/AGENTS.md) — Utility catalog with consumers
- [`src/domain/AGENTS.md`](src/domain/AGENTS.md) — Domain models, ports, zero-dep rule
