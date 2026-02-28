# Domain Layer Guide

Pure types and interfaces — **ZERO external dependencies**. No `obsidian`, no `@agentclientprotocol/sdk`, no React.

## Structure

```
domain/
├── models/          # Data types (8 files)
│   ├── chat-message.ts      # ChatMessage, MessageContent union, Role, ToolCallStatus, ToolKind
│   ├── session-update.ts    # SessionUpdate union (13 types) — agent → UI event stream
│   ├── chat-session.ts      # ChatSession state, SessionState, SlashCommand, AuthenticationMethod
│   ├── agent-config.ts      # BaseAgentSettings, ClaudeAgentSettings, GeminiAgentSettings, CodexAgentSettings, CustomAgentSettings
│   ├── agent-error.ts       # AcpErrorCode enum, ErrorInfo, AcpError, ProcessError
│   ├── session-info.ts      # SessionInfo, ListSessionsResult, LoadSessionResult, ResumeSessionResult, ForkSessionResult
│   ├── prompt-content.ts    # PromptContent union (text, image, resource), ResourceAnnotations
│   └── chat-input-state.ts  # ChatInputState, AttachedImage (for broadcast)
└── ports/           # Interface contracts (4 files)
    ├── agent-client.port.ts    # IAgentClient — 423 lines, full agent communication contract
    ├── vault-access.port.ts    # IVaultAccess — note search, read, active file tracking
    ├── settings-access.port.ts # ISettingsAccess — settings CRUD + session persistence
    └── chat-view-container.port.ts # IChatViewContainer — view registration, focus, broadcast
```

## Critical Types

**SessionUpdate** (`session-update.ts`): Discriminated union of 13 event types — the backbone of agent → UI communication:
`agent_message_chunk` | `agent_thought_chunk` | `user_message_chunk` | `tool_call` | `tool_call_update` | `end_turn` | `plan_update` | `plan_completed` | `available_commands_update` | `current_mode_update` | `current_model_update` | `session_title_update` | `agent_capabilities_update`

**MessageContent** (`chat-message.ts`): Union of content types within a `ChatMessage`:
`text` | `text_with_context` | `image` | `tool_call` | `thought` | `plan`

**ChatSession** (`chat-session.ts`): Full session state including `SessionState`, available modes/models, agent capabilities, slash commands.

## Ports → Implementations

| Port | Adapter |
|------|---------|
| `IAgentClient` | `adapters/acp/acp.adapter.ts` → `AcpAdapter` |
| `IVaultAccess` | `adapters/obsidian/vault.adapter.ts` → `ObsidianVaultAdapter` |
| `ISettingsAccess` | `adapters/obsidian/settings-store.ts` → `SettingsStore` |
| `IChatViewContainer` | `components/chat/ChatView.tsx`, `FloatingChatView.tsx` |

## Zero-Dep Rule Enforcement

**NEVER add these imports in `domain/`:**
- `import { ... } from "obsidian"`
- `import * as acp from "@agentclientprotocol/sdk"`
- `import { ... } from "react"`

**Why**: Domain types flow everywhere (hooks, components, adapters, shared). If domain imports `obsidian`, the entire dependency graph tightens. ACP SDK evolves rapidly — isolation keeps domain stable across protocol changes.

**Only exception**: `settings-access.port.ts` imports `AgentClientPluginSettings` from `../../plugin` — this is a pragmatic coupling to the plugin's settings type, not an external library.

## Adding a New Domain Type

1. Create/extend in `models/` — pure TypeScript interfaces/types only
2. If it represents an agent event → add variant to `SessionUpdate` union
3. If it needs adapter conversion → update `AcpTypeConverter` in `adapters/acp/`
4. If it's a new capability → extend `IAgentClient` port, then implement in `AcpAdapter`
