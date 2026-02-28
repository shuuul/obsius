# Chat Components Guide

23 components for the chat UI. Two entry points: `ChatView` (sidebar/Obsidian leaf) and `FloatingChatView` (draggable window).

## Component Tree

```
ChatView (ItemView, 880 lines) ─── Obsidian sidebar leaf
  └── ChatComponent (React)
        ├── ChatHeader          ─ agent label, session controls, settings gear
        ├── ChatMessages        ─ scrollable message list
        │     └── MessageRenderer (per message)
        │           └── MessageContentRenderer (per content block)
        │                 ├── MarkdownTextRenderer  ─ markdown → Obsidian renderMarkdown
        │                 ├── TextWithMentions      ─ @[[note]] link rendering
        │                 ├── ToolCallRenderer      ─ tool call accordion
        │                 │     ├── TerminalRenderer  ─ polling terminal output
        │                 │     └── PermissionRequestSection ─ approve/deny buttons
        │                 ├── CollapsibleThought    ─ agent reasoning toggle
        │                 └── InlineHeader          ─ plan entries
        ├── SuggestionDropdown  ─ @mention + /command dropdown
        ├── ImagePreviewStrip   ─ attached image thumbnails
        ├── ChatInput           ─ textarea + send button (507 lines)
        │     └── chat-input/     use-image-attachments, use-chat-input-behavior, InputActions, etc.
        └── ErrorOverlay        ─ session error display

FloatingChatView (820 lines) ─── standalone window, NOT an ItemView
  └── Same ChatComponent tree via useChatController

SessionHistoryModal (Modal) ─── Obsidian modal for session list
SessionHistoryContent (React) ─── React content inside the modal
ConfirmDeleteModal (Modal) ─── delete session confirmation
FloatingButton ─── toggle button for floating chat
HeaderButton ─── reusable icon button for header
```

## Entry Points

**ChatView**: Extends `ItemView`. Manages Obsidian leaf lifecycle, view state persistence (agent ID, expanded state), `IChatViewContainer` implementation for registry. Creates React root in `onOpen()`, destroys in `onClose()`.

**FloatingChatView**: NOT an `ItemView` — creates its own HTML container appended to `document.body`. Handles drag, resize, collapse, minimize. Implements `IChatViewContainer` independently.

Both share `ChatComponent` which calls `useChatController()` — all logic lives in hooks.

## IChatViewHost Interface (`types.ts`)

Components that need DOM event cleanup depend on `IChatViewHost` (not `ChatView` directly). This lets both sidebar and floating views provide `registerDomEvent` and `app` access without coupling.

## Rendering Patterns

**Markdown**: `MarkdownTextRenderer` calls Obsidian's `MarkdownRenderer.render()` into a `<div ref>`. Must handle async rendering and cleanup.

**Terminal output**: `TerminalRenderer` polls `acpClient.terminalOutput()` on interval. Shows live output + exit status.

**Diff display**: `ToolCallRenderer` uses `diff` library to generate unified diff view. Computes relative paths via `toRelativePath()`.

**Permission UI**: `PermissionRequestSection` renders approve/deny options. Local `selectedOptionId` state for immediate feedback before server confirms.

## Obsidian Integration Rules

- Use `createEl`/`createDiv` in non-React Obsidian classes (Modal, ItemView methods)
- React components use JSX normally — only raw Obsidian APIs need element helpers
- `registerDomEvent` for event cleanup tied to view lifecycle
- `Platform.isDesktopApp` guard in `ChatComponent` — throws on mobile

## Adding a Component

1. Create `PascalCase.tsx` in this directory
2. Accept props from `useChatController` return — not raw plugin/adapter
3. Register DOM events via `IChatViewHost.registerDomEvent` for cleanup
4. Style in `styles.css` (root-level) — no CSS modules, no JS styles
