# Hooks Layer Guide

Central coordinator pattern: `useChatController` composes 9 specialized hooks + creates adapters via `useMemo`.

## Hook Inventory

| Hook | Lines | State Owned | Key Deps |
|------|-------|-------------|----------|
| `useChatController` | 858 | Combines all below | All hooks + adapters |
| `useAgentSession` | 952 | `ChatSession`, connection lifecycle | `IAgentClient`, `ISettingsAccess` |
| `useChat` | 706 | `messages[]`, `isSending`, streaming | `IAgentClient`, `IVaultAccess` |
| `useSessionHistory` | 734 | Session list, load/resume/fork | `IAgentClient`, `ISettingsAccess` |
| `usePermission` | 224 | `activePermission`, approval queue | `IAgentClient` |
| `useAutoExport` | 162 | None (stateless callbacks) | `ChatExporter` |
| `useMentions` | 130 | Suggestions dropdown state | `IVaultAccess`, `mention-utils` |
| `useSlashCommands` | 140 | Suggestions dropdown state | `SlashCommand[]` |
| `useAutoMention` | 62 | `activeNote`, `isDisabled` | `IVaultAccess` |
| `useInputHistory` | 143 | History index (ref-based) | `ChatMessage[]` |
| `useSettings` | 19 | None — delegates to `useSyncExternalStore` | `plugin.settingsStore` |

## Composition Flow

```
useChatController(plugin, viewId, workingDir, initialAgentId)
  ├── useMemo: AcpAdapter (from plugin.chatViewRegistry)
  ├── useMemo: ObsidianVaultAdapter
  ├── useMemo: NoteMentionService
  ├── useSettings(plugin)
  ├── useAgentSession(acpAdapter, settingsAccess, config)
  ├── useChat(acpAdapter, vaultAccess, mentionService, session)
  ├── usePermission(acpAdapter)
  ├── useMentions(vaultAccess, plugin)
  ├── useSlashCommands(session.availableCommands, autoMention.toggle)
  ├── useAutoMention(vaultAccess)
  ├── useAutoExport(plugin)
  └── useSessionHistory(acpAdapter, session, settingsAccess, cwd, callbacks)
```

## Race Condition Patterns

**Streaming tool_call_update**: Multiple rapid updates arrive for the same tool call. `useChat` uses functional `setMessages((prev) => ...)` with `upsertToolCall()` to merge safely. Direct `setMessages(newArray)` would lose concurrent updates.

**mergeToolCallContent**: When merging tool call updates, preserve existing values when update fields are `undefined`. Treat content arrays as replace-all (not append).

**Session load history replay**: During `session/load`, the agent replays history as `user_message_chunk` + `agent_message_chunk` events. `useChat` has `isLoadingRef` flag to batch these without triggering intermediate re-renders.

## Key Callbacks Wired in useChatController

- `handleSessionUpdate`: Routes `SessionUpdate` union to `useChat.handleSessionUpdate()` (messages) and `useAgentSession` (commands, modes)
- `handleSendMessage`: Orchestrates `useChat.sendMessage()` with autoMention state, images, vault path
- `handleNewSession`: Auto-exports previous chat, then calls `useAgentSession.createSession()`
- `handleLoadSession`: Coordinates `useSessionHistory` + `useChat.setInitialMessages()`

## Adding a New Hook

1. Create `src/hooks/useFeature.ts` — own its state, export typed return interface
2. Wire into `useChatController.ts` — add to composition, expose in return object
3. Access in components via `useChatController()` return value
4. Never import hooks directly in components — always go through the controller

## Anti-Patterns

- Don't use `setMessages(newArray)` for streaming updates — always functional updater
- Don't store derived state — compute from `messages` or `session` in components
- Don't call `agentClient` directly from components — route through hooks
