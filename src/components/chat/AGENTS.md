# Chat Components Guide

27 components for the chat UI. Entry point: `ChatView` (sidebar/Obsidian leaf). Includes `chat-input/` subdirectory with 11 files for input-related components and hooks.

## Component Tree

```
ChatView (ItemView, ~509 lines) ─── Obsidian sidebar leaf
  └── ChatComponent (React)
        ├── ChatHeader          ─ agent label, session controls, settings gear (~178 lines)
        ├── TabBar              ─ multi-tab navigation (~59 lines)
        ├── TabContent          ─ per-tab chat view container (~209 lines)
        │     ├── ChatMessages        ─ scrollable message list (~157 lines)
        │     │     └── MessageRenderer (per message)
        │     │           └── MessageContentRenderer (per content block)
        │     │                 ├── MarkdownTextRenderer  ─ markdown → Obsidian renderMarkdown
        │     │                 ├── TextWithMentions      ─ @[[note]] link rendering
        │     │                 ├── ToolCallRenderer      ─ tool call accordion (~263 lines)
        │     │                 │     ├── DiffRenderer       ─ unified diff view (~324 lines)
        │     │                 │     ├── TerminalRenderer   ─ polling terminal output (~143 lines)
        │     │                 │     └── PermissionRequestSection ─ approve/deny buttons
        │     │                 ├── CollapsibleThought    ─ agent reasoning toggle
        │     │                 └── CollapsibleSection    ─ generic collapsible wrapper (~41 lines)
        │     ├── SuggestionDropdown  ─ @mention + /command dropdown (~147 lines)
        │     ├── ImagePreviewStrip   ─ attached image thumbnails
        │     └── ChatInput           ─ input orchestrator (~353 lines)
        │           └── chat-input/
        │                 ├── RichTextarea          ─ contenteditable input (~348 lines)
        │                 ├── InputActions          ─ send/stop/attach buttons (~106 lines)
        │                 ├── SelectorButton        ─ mode/model dropdown trigger (~164 lines)
        │                 ├── MentionBadgeStrip     ─ attached note badges (~106 lines)
        │                 ├── AutoMentionBadge      ─ active note indicator (~68 lines)
        │                 ├── ProviderLogo          ─ CDN SVG brand icons (~35 lines)
        │                 ├── use-chat-input-behavior ─ input keydown/submit logic (~208 lines)
        │                 ├── use-image-attachments   ─ paste/drop image handling (~175 lines)
        │                 ├── use-obsidian-dropdown   ─ Obsidian DropdownComponent bridge (~68 lines)
        │                 ├── mode-icons.ts           ─ agent mode icon mapping (~143 lines)
        │                 └── file-icons.ts           ─ file extension icon mapping (~55 lines)
        └── ErrorOverlay        ─ session error display

SessionHistoryModal (Modal) ─── Obsidian modal for session list
SessionHistoryContent (React) ─── React content inside modal (~499 lines)
ConfirmDeleteModal (Modal) ─── delete session confirmation
HeaderButton ─── reusable icon button for header
ObsidianIcon ─── Obsidian Lucide icon wrapper (~29 lines)
```

## Entry Point

**ChatView**: Extends `ItemView`. Manages Obsidian leaf lifecycle, view state persistence (agent ID), `IChatViewContainer` implementation for registry. Creates React root in `onOpen()`, destroys in `onClose()`. Workspace event handling delegated to `useWorkspaceEvents` hook.

`ChatComponent` calls `useChatController()` — all logic lives in hooks.

## Tab System

`TabBar` renders tab headers; `TabContent` renders per-tab chat. Each tab has its own `useChatController` instance with independent agent session, messages, and state. `useTabs` hook manages tab lifecycle (max 4 tabs).

## IChatViewHost Interface (`types.ts`)

Components that need DOM event cleanup depend on `IChatViewHost` (not `ChatView` directly). This decouples components from the concrete view implementation.

## chat-input/ Subdirectory

Input-related components extracted from `ChatInput.tsx`. Contains:
- **3 hooks**: `use-chat-input-behavior` (keydown/submit), `use-image-attachments` (paste/drop), `use-obsidian-dropdown` (native Obsidian dropdown bridge)
- **5 components**: `RichTextarea`, `InputActions`, `SelectorButton`, `MentionBadgeStrip`, `AutoMentionBadge`, `ProviderLogo`
- **2 icon maps**: `mode-icons.ts`, `file-icons.ts`

Note: hooks in `chat-input/` use `kebab-case` naming (not `usePascalCase`) since they're input-specific, not controller-level.

## Rendering Patterns

**Markdown**: `MarkdownTextRenderer` calls Obsidian's `MarkdownRenderer.render()` into a `<div ref>`. Must handle async rendering and cleanup.

**Terminal output**: `TerminalRenderer` polls `acpClient.terminalOutput()` on interval. Shows live output + exit status.

**Diff display**: `DiffRenderer` uses `diff` library to generate unified diff view with word-level highlighting. Computes relative paths via `toRelativePath()`.

**Permission UI**: `PermissionRequestSection` renders approve/deny options. Local `selectedOptionId` state for immediate feedback before server confirms.

**Provider logos**: `ProviderLogo` loads SVGs from `@lobehub/icons-static-svg` CDN via CSS `mask-image` — inherits `currentColor` for theme compatibility.

## Obsidian Integration Rules

- Use `createEl`/`createDiv` in non-React Obsidian classes (Modal, ItemView methods)
- React components use JSX normally — only raw Obsidian APIs need element helpers
- `registerDomEvent` for event cleanup tied to view lifecycle
- `Platform.isDesktopApp` guard in `ChatComponent` — throws on mobile

## Adding a Component

1. Create `PascalCase.tsx` in this directory (or `chat-input/` for input-related)
2. Accept props from `useChatController` return — not raw plugin/adapter
3. Register DOM events via `IChatViewHost.registerDomEvent` for cleanup
4. Style in `styles.css` (root-level) — no CSS modules, no JS styles
