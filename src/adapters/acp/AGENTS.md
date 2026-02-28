# ACP Adapter Guide

2 files implementing the Agent Client Protocol bridge between domain ports and `@agentclientprotocol/sdk`.

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `acp.adapter.ts` | 1678 | `AcpAdapter` class — process lifecycle, JSON-RPC, session updates, terminals, permissions |
| `acp-type-converter.ts` | 80 | `AcpTypeConverter` — bidirectional type mapping (ACP SDK ↔ domain types) |

## AcpAdapter Class

Implements both `IAgentClient` (domain port) and `IAcpClient` (extended UI interface).

### Key Responsibilities

1. **Process lifecycle**: `spawn` agent child process, monitor stdout/stderr, handle exit/crash
2. **JSON-RPC over stdin/stdout**: `ClientSideConnection` from ACP SDK handles framing
3. **Session updates**: Single `sessionUpdateCallback` dispatches all `SessionUpdate` types to hooks
4. **Terminal management**: Delegates to `TerminalManager` (shared/) for command execution
5. **Permission flow**: `pendingPermissionRequests` Map + `pendingPermissionQueue` array for sequential handling
6. **Silent failure detection**: `promptSessionUpdateCount` tracks whether agent responded; `recentStderr` captures diagnostics

### IAcpClient (Extended Interface)

Adds ACP-specific operations beyond domain `IAgentClient`:
- `handlePermissionResponse(requestId, optionId)` — resolve pending permission promise
- `cancelAllOperations()` — abort in-flight requests
- `resetCurrentMessage()` — clear streaming message state
- `terminalOutput(params)` — poll terminal output for `TerminalRenderer`

### Platform Handling

- **Windows (non-WSL)**: Enhanced PATH via `getEnhancedWindowsEnv()`, `escapeShellArgWindows()`
- **Windows (WSL mode)**: Path conversion via `wrapCommandForWsl()`, `convertWindowsPathToWsl()`
- **macOS/Linux**: Login shell resolution via `getLoginShell()`, `$SHELL` env

## AcpTypeConverter

Static methods for SDK ↔ domain conversion:
- `toToolCallContent(acp.ToolCallContent[])` → domain `ToolCallContent[]` — filters to `diff` + `terminal` only (ignores `content` type)
- `toAcpContentBlock(PromptContent)` → `acp.ContentBlock` — handles text, image, resource

## When ACP Protocol Changes

1. Update `@agentclientprotocol/sdk` version
2. Modify `AcpTypeConverter` for new/changed types
3. Update `AcpAdapter` for new JSON-RPC methods or notification types
4. Add new `SessionUpdate` variants in `domain/models/session-update.ts`
5. Handle new updates in `useChat.handleSessionUpdate()`

Domain layer (`domain/`) stays untouched unless new domain concepts are needed.

## Anti-Patterns

- Don't import `@agentclientprotocol/sdk` outside this directory (except `TerminalManager` which uses `acp.TerminalOutputRequest`)
- Don't expose ACP SDK types to hooks/components — always convert to domain types first
- Don't add multiple event callbacks — use unified `sessionUpdateCallback`
