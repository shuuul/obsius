# Obsidian Plugin API Reference

Official Obsidian plugin development documentation:

- **API Reference**: [https://docs.obsidian.md/Reference](https://docs.obsidian.md/Reference)

This is the canonical reference for all Obsidian APIs (`Plugin`, `Workspace`, `Vault`, `MarkdownView`, `Platform`, element helpers like `createEl`/`createDiv`, etc.).

## Key APIs Used by This Plugin

| API | Usage |
|-----|-------|
| `Plugin` | Base class for plugin lifecycle (`onload`, `onunload`) |
| `ItemView` | Custom view pane for the chat UI |
| `Platform` | Platform detection (`isDesktopApp`, `isWin`, `isMacOS`) |
| `Vault` | Note reading and file operations |
| `Setting` | Settings tab UI construction |
| `MarkdownRenderer` | Rendering markdown content in chat messages |