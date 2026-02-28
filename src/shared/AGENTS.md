# Shared Utilities Guide

15 pure utility files — no React dependencies. Business logic extracted from hooks/adapters for reuse and testability.

## Utility Catalog

| File | Lines | Purpose | Consumers |
|------|-------|---------|-----------|
| `message-service.ts` | 689 | Prompt preparation: mention processing, auto-mention, WSL path conversion, auth retry | `useChat` |
| `chat-exporter.ts` | 552 | Export messages to markdown files, image handling (base64/file/obsidian) | `useAutoExport` |
| `terminal-manager.ts` | 286 | Spawn terminal processes, poll output, platform shell wrapping | `AcpAdapter` |
| `chat-view-registry.ts` | 219 | Multi-view management: register/unregister/focus/broadcast/navigate | `plugin.ts` |
| `acp-error-utils.ts` | 205 | ACP JSON-RPC error extraction, user-friendly `ErrorInfo` generation | `useChat`, `useAgentSession` |
| `settings-utils.ts` | 145 | `sanitizeArgs`, `normalizeEnvVars`, `toAgentConfig` conversion | `useAgentSession`, `AgentClientSettingTab` |
| `mention-utils.ts` | 138 | `detectMention`, `replaceMention`, `extractMentionedNotes` parsing | `useMentions`, `message-service` |
| `path-utils.ts` | 63 | `resolveCommandDirectory`, `toRelativePath`, `buildFileUri` | `AcpAdapter`, `ToolCallRenderer` |
| `wsl-utils.ts` | 98 | `convertWindowsPathToWsl`, `wrapCommandForWsl` | `AcpAdapter`, `message-service` |
| `windows-env.ts` | 129 | `getFullWindowsPath`, `getEnhancedWindowsEnv` — registry PATH query | `AcpAdapter`, `TerminalManager` |
| `session-capability-utils.ts` | 42 | `getSessionCapabilityFlags` — boolean flags from `AgentCapabilities` | `useSessionHistory` |
| `shell-utils.ts` | 36 | `escapeShellArgWindows`, `getLoginShell` | `AcpAdapter`, `TerminalManager` |
| `display-settings.ts` | 36 | `parseChatFontSize` — clamped integer parse (10–30) | `plugin.ts` |
| `floating-utils.ts` | 14 | `clampPosition` — viewport bounds for floating window | `FloatingChatView` |
| `logger.ts` | 44 | `Logger` class + `getLogger` singleton — debug-mode gated logging | everywhere |

## Key Patterns

**message-service.ts** (`preparePrompt` + `sendPreparedPrompt`):
- Separates display content (original text + images) from agent content (processed mentions → file paths/URIs)
- Supports `embeddedContext` capability: attaches note content as `resource` type instead of text
- Auth retry: catches `AUTHENTICATION_REQUIRED` error, invokes `authenticate()`, retries once
- WSL mode: converts Windows paths to `/mnt/c/...` format when `convertToWsl` flag set

**chat-view-registry.ts**:
- Views self-register on mount, unregister on close
- `focusNext`/`focusPrevious` cycles through registered views
- `broadcastTo` sends input state to all views of a type
- Focus order is registration order (not workspace leaf order) — intentional simplification

**terminal-manager.ts**:
- Spawns child processes with platform-specific shell wrapping
- Output accumulation with byte limit, polling via `getTerminalOutput()`
- Auto-cleanup timeout after process exit

## Adding a Utility

1. Create `kebab-case.ts` in this directory
2. Export pure functions — no React hooks, no `obsidian` imports if possible
3. Exception: `terminal-manager.ts`, `chat-exporter.ts`, `mention-utils.ts` import from `obsidian` — keep to minimum
4. Document consumers in this table
