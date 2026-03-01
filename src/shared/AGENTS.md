# Shared Utilities Guide

Pure utility modules with no React dependencies. Business logic extracted from hooks/adapters for reuse and testability.

## Utility Catalog

| File | Lines | Purpose | Consumers |
|------|-------|---------|-----------|
| `message-service.ts` | 12 | Facade re-export for message-service modules | `useChat` |
| `message-service/prompt-preparation.ts` | 351 | Prompt preparation: mention processing, auto-mention, WSL path conversion | `useChat` |
| `message-service/prompt-sending.ts` | 113 | Prompt send path + auth retry + content type mapping | `useChat` |
| `message-service/types.ts` | 53 | Message-service shared types | `useChat` |
| `terminal-manager.ts` | 277 | Spawn terminal processes, poll output, platform shell wrapping | `AcpAdapter` |
| `chat-view-registry.ts` | 214 | Multi-view management: register/unregister/focus/broadcast/navigate | `plugin.ts` |
| `acp-error-utils.ts` | 205 | ACP JSON-RPC error extraction, user-friendly `ErrorInfo` generation | `useChat`, `useAgentSession` |
| `settings-schema.ts` | 198 | Zod-based settings validation with schema versioning (v4) | `SettingsStore` |
| `tool-icons.ts` | 221 | Tool title/kind -> Obsidian Lucide icon name mapping | `ToolCallRenderer` |
| `settings-utils.ts` | 164 | `sanitizeArgs`, `normalizeEnvVars`, `toAgentConfig` conversion | `useAgentSession`, `AgentClientSettingTab` |
| `mention-utils.ts` | 138 | `detectMention`, `replaceMention`, `extractMentionedNotes` parsing | `useMentions`, `message-service` |
| `windows-env.ts` | 129 | `getFullWindowsPath`, `getEnhancedWindowsEnv` — registry PATH query | `AcpAdapter`, `TerminalManager` |
| `wsl-utils.ts` | ~98 | `convertWindowsPathToWsl`, `wrapCommandForWsl` | `AcpAdapter`, `message-service` |
| `path-utils.ts` | ~63 | `resolveCommandDirectory`, `toRelativePath`, `buildFileUri` | `AcpAdapter`, `ToolCallRenderer` |
| `session-capability-utils.ts` | ~42 | `getSessionCapabilityFlags` — boolean flags from `AgentCapabilities` | `useSessionHistory` |
| `shell-utils.ts` | ~36 | `escapeShellArgWindows`, `getLoginShell` | `AcpAdapter`, `TerminalManager` |
| `display-settings.ts` | ~36 | `parseChatFontSize` — clamped integer parse (10-30) | `plugin.ts` |
| `plugin-notice.ts` | 10 | `pluginNotice` — prefixed `Notice` wrapper (template literal bypasses sentence-case lint) | hooks, plugin, components |
| `logger.ts` | 44 | `Logger` class + `getLogger` singleton — debug-mode gated logging | everywhere |

## Key Patterns

**message-service modules** (`preparePrompt` + `sendPreparedPrompt`):
- Separates display content (original text + images) from agent content (processed mentions -> file paths/URIs)
- Supports `embeddedContext` capability: attaches note content as `resource` type instead of text
- Auth retry: catches `AUTHENTICATION_REQUIRED` error, invokes `authenticate()`, retries once
- WSL mode: converts Windows paths to `/mnt/c/...` format when `convertToWsl` flag set

**settings-schema.ts**:
- Zod schemas validate persisted settings on load (migration safety net)
- `SETTINGS_SCHEMA_VERSION` (currently 4) tracks breaking changes
- `satisfies z.ZodType<T>` pattern ensures schema stays in sync with TypeScript types

**chat-view-registry.ts**:
- Views self-register on mount, unregister on close
- `focusNext`/`focusPrevious` cycles through registered views
- `broadcastTo` sends input state to all views of a type
- Focus order is registration order (not workspace leaf order) — intentional simplification

**terminal-manager.ts**:
- Spawns child processes with platform-specific shell wrapping
- Output accumulation with byte limit, polling via `getTerminalOutput()`
- Auto-cleanup timeout after process exit

**tool-icons.ts**:
- Maps tool titles (Read, Write, Bash, etc.) and `ToolKind` to Obsidian Lucide icon names
- Fallback chain: exact title match -> kind match -> default "wrench"

## Adding a Utility

1. Create `kebab-case.ts` in this directory
2. Export pure functions — no React hooks, no `obsidian` imports if possible
3. Exception: `terminal-manager.ts`, `mention-utils.ts` import from `obsidian` — keep to minimum
4. Document consumers in this table
