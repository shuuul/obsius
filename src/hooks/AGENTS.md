# Hooks Layer Guide

Central coordinator pattern: `useChatController` composes 9 specialized hooks + creates adapters via `useMemo`. View-level concerns extracted to `useWorkspaceEvents`.

State transitions are reducer-backed in `src/hooks/state/` for deterministic updates and easier test coverage.

## Hook Inventory

| Hook | Lines | State Owned | Key Deps |
|------|-------|-------------|----------|
| `useChatController` | 624 | Combines all below | All hooks + adapters |
| `useAgentSession` | 628 | `ChatSession`, connection lifecycle | `IAgentClient`, `ISettingsAccess` |
| `useChat` | 552 | `messages[]`, `isSending`, streaming | `IAgentClient`, `IVaultAccess` |
| `useSessionHistory` | 577 | Session list, load/resume/fork | `IAgentClient`, `ISettingsAccess` |
| `usePermission` | 234 | `activePermission`, approval queue | `IAgentClient` |
| `useMentions` | 130 | Suggestions dropdown state | `IVaultAccess`, `mention-utils` |
| `useSlashCommands` | 140 | Suggestions dropdown state | `SlashCommand[]` |
| `useAutoMention` | ~90 | `activeNote`, `isDisabled` | `IVaultAccess` |
| `useInputHistory` | 139 | History index (ref-based) | `ChatMessage[]` |
| `useTabs` | 114 | `tabs[]`, `activeTabId` (max 4) | `ChatTab`, agent info |
| `useSettings` | ~30 | None — delegates to `useSyncExternalStore` | `plugin.settingsStore` |
| `useWorkspaceEvents` | 127 | None (effect-only) | `Workspace` events |

## Composition Flow

```
useChatController(plugin, viewId, workingDir, initialAgentId)
  ├── useMemo: AcpAdapter (from plugin.chatViewRegistry)
  ├── useMemo: ObsidianVaultAdapter
  ├── useMemo: NoteMentionService
  ├── useSettings(plugin)
  ├── useTabs(initialAgentId, defaultAgentId, availableAgents, onTabClose)
  ├── useAgentSession(acpAdapter, settingsAccess, config)
  ├── useChat(acpAdapter, vaultAccess, mentionService, session)
  ├── usePermission(acpAdapter)
  ├── useMentions(vaultAccess, plugin)
  ├── useSlashCommands(session.availableCommands, autoMention.toggle)
  ├── useAutoMention(vaultAccess)
  ├── useSessionHistory(acpAdapter, session, settingsAccess, cwd, callbacks)
  └── useSessionHistoryHandlers(app, sessionHistory, logger, vaultPath, clearMessages)
```

## Extracted Hook Modules

- `chat-controller/types.ts` (82): exported `UseChatController` interfaces to keep the coordinator lean
- `chat-controller/session-history-handlers.ts` (184): isolated history restore/fork/delete/open handler orchestration (popover state)
- `agent-session/helpers.ts` (141) + `agent-session/types.ts` (39): normalization and shared type contracts
- `session-history/session-history-ops.ts` (221): pure history list/load/restore/fork helpers

## State Modules (`hooks/state/`)

| File | Lines | Purpose |
|------|-------|---------|
| `chat.reducer.ts` | 50 | Chat message state reducer (apply_messages, set_messages, clear) |
| `chat.actions.ts` | 29 | Action creators for chat state transitions |
| `session.reducer.ts` | 28 | Session state reducer |
| `session.actions.ts` | 22 | Action creators for session state transitions |
| `permission.reducer.ts` | 35 | Permission request queue reducer |

## View-Level Hooks (used directly by ChatView, not via useChatController)

- `useWorkspaceEvents`: Subscribes to workspace hotkey events (toggle-auto-mention, new-chat-requested, approve/reject permission, cancel-message).

## Race Condition Patterns

**Agent switch staleness**: `useAgentSession.createSession` uses a `creationCounterRef` to discard stale async results when the user switches agents before the previous session is ready.

**Streaming tool_call_update**: Multiple rapid updates arrive for the same tool call. `useChat` uses reducer actions with updater payloads (`apply_messages`) and `upsertToolCall()` merge logic. Non-functional replacement would lose concurrent updates.

**mergeToolCallContent**: When merging tool call updates, preserve existing values when update fields are `undefined`. Treat content arrays as replace-all (not append).

**Session load history replay**: During `session/load`, the agent replays history as `user_message_chunk` + `agent_message_chunk` events. `useChat` has `isLoadingRef` flag to batch these without triggering intermediate re-renders.

## Key Callbacks Wired in useChatController

- `handleSessionUpdate`: Routes `SessionUpdate` union to `useChat.handleSessionUpdate()` (messages) and `useAgentSession` (commands, modes)
- `handleSendMessage`: Orchestrates `useChat.sendMessage()` with autoMention state, images, vault path
- `handleNewSession`: Calls `useAgentSession.createSession()`
- `handleLoadSession`: Coordinates `useSessionHistory` + `useChat.setInitialMessages()`

## Adding a New Hook

1. Create `src/hooks/useFeature.ts` — own its state, export typed return interface
2. Wire into `useChatController.ts` — add to composition, expose in return object
3. Access in components via `useChatController()` return value
4. Never import hooks directly in components — always go through the controller

## Anti-Patterns

- Don't bypass reducers for state transitions in `useChat` / `useAgentSession` / `usePermission`
- Don't store derived state — compute from `messages` or `session` in components
- Don't call `agentClient` directly from components — route through hooks
- Don't add new callback-style mutation paths when a typed action in `src/hooks/state/` is appropriate
