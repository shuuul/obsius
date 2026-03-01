# Chat Components Guide

30 components for the chat UI. Entry point: `ChatView` (sidebar/Obsidian leaf). Includes `chat-input/` subdirectory with 11 files for input-related components and hooks.

## Component Tree

```
ChatView (ItemView, ~538 lines) ─── Obsidian sidebar leaf
  └── ChatComponent (React)
        ├── ChatHeader          ─ agent dropdown, session controls, update badge (~178 lines)
        │     ├── TabBar              ─ numbered tab badges (1,2,3…) (~59 lines)
        │     └── HeaderButton × 4    ─ new tab / new session / history / settings
        └── TabContent          ─ per-tab chat view container (~209 lines)
              ├── SessionHistoryPopover ─ floating session list panel
              │     └── SessionHistoryContent ─ session list + restore/fork/delete (~498 lines)
              │           └── ConfirmDeleteModal (Obsidian Modal)
              ├── ChatMessages        ─ scrollable message list (~157 lines)
              │     └── MessageRenderer (per message)
              │           └── MessageContentRenderer (per content block)
              │                 ├── MarkdownTextRenderer  ─ markdown → Obsidian renderMarkdown
              │                 ├── TextWithMentions      ─ @[[note]] + context token rendering
              │                 ├── ToolCallRenderer      ─ tool call accordion (~263 lines)
              │                 │     ├── DiffRenderer       ─ unified diff view (~324 lines)
              │                 │     ├── TerminalRenderer   ─ polling terminal output (~143 lines)
              │                 │     └── PermissionRequestSection ─ approve/deny buttons
              │                 ├── CollapsibleThought    ─ agent reasoning toggle
              │                 └── CollapsibleSection    ─ generic collapsible wrapper (~41 lines)
              ├── SuggestionDropdown  ─ @mention + /command dropdown (~147 lines)
              └── ChatInput           ─ input orchestrator (~399 lines)
                    ├── ErrorOverlay        ─ error banner above input
                    ├── SuggestionDropdown  ─ (mentions + slash commands, 2 instances)
                    ├── ContextBadgeStrip   ─ auto-mention + context reference badges
                    ├── RichTextarea        ─ contenteditable input (~348 lines)
                    ├── ImagePreviewStrip   ─ attached image thumbnails
                    └── InputActions        ─ mode/model selectors + send/stop (~106 lines)
                          ├── SelectorButton (mode) ─ portal-based popover (~164 lines)
                          ├── SelectorButton (model)
                          └── Send/Stop button

Standalone:
  HeaderButton        ─ reusable icon button for header
  ObsidianIcon        ─ Obsidian Lucide icon wrapper (~29 lines)
  ProviderLogo        ─ CDN SVG brand icons (~35 lines)
  MentionBadgeStrip   ─ attached note badges (~106 lines)
  AutoMentionBadge    ─ active note indicator (~68 lines)
```

## Entry Point

**ChatView**: Extends `ItemView`. Manages Obsidian leaf lifecycle, view state persistence (agent ID), `IChatViewContainer` implementation for registry. Creates React root in `onOpen()`, destroys in `onClose()`. Workspace event handling delegated to `useWorkspaceEvents` hook.

`ChatComponent` calls `useChatController()` — all logic lives in hooks.

## Tab System

`TabBar` renders tab headers; `TabContent` renders per-tab chat. Each tab has its own `useChatController` instance with independent agent session, messages, and state. `useTabs` hook manages tab lifecycle (max 4 tabs).

## Session History

Session history uses a popover pattern (not a modal). `SessionHistoryPopover` wraps `SessionHistoryContent` in a floating panel toggled via the header history button. `useSessionHistoryHandlers` manages the popover open/close state.

## IChatViewHost Interface (`types.ts`)

Components that need DOM event cleanup depend on `IChatViewHost` (not `ChatView` directly). This decouples components from the concrete view implementation.

## chat-input/ Subdirectory

Input-related components extracted from `ChatInput.tsx`. Contains:
- **3 hooks**: `use-chat-input-behavior` (keydown/submit), `use-image-attachments` (paste/drop), `use-obsidian-dropdown` (native Obsidian dropdown bridge)
- **5 components**: `RichTextarea`, `InputActions`, `SelectorButton`, `ProviderLogo`, `ContextBadgeStrip` (via parent), `MentionBadgeStrip`, `AutoMentionBadge`
- **2 icon maps**: `mode-icons.ts`, `file-icons.ts`

Note: hooks in `chat-input/` use `kebab-case` naming (not `usePascalCase`) since they're input-specific, not controller-level.

## Rendering Patterns

**Markdown**: `MarkdownTextRenderer` calls Obsidian's `MarkdownRenderer.render()` into a `<div ref>`. Must handle async rendering and cleanup.

**Terminal output**: `TerminalRenderer` polls `acpClient.terminalOutput()` on interval. Shows live output + exit status.

**Diff display**: `DiffRenderer` uses `diff` library to generate unified diff view with word-level highlighting. Computes relative paths via `toRelativePath()`.

**Permission UI**: `PermissionRequestSection` renders approve/deny options. Local `selectedOptionId` state for immediate feedback before server confirms.

**Provider logos**: `ProviderLogo` loads SVGs from `@lobehub/icons-static-svg` CDN via CSS `mask-image` — inherits `currentColor` for theme compatibility.

**Context badges**: `ContextBadgeStrip` renders auto-mention and context reference badges above the input. Uses `chat-context-token.ts` for token parsing/formatting.

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
