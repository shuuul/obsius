# Obsius Development Plan

## Roadmap

### Session File Restoration

Track files changed during a session and offer restoration on session load. When the agent edits files, record the original content so users can revert changes if they restore a previous session.

- [ ] Track file paths modified by tool calls during a session
- [ ] Store original file content (or diff) alongside session messages
- [ ] On session restore, prompt user to revert changed files to pre-session state
- [ ] Handle conflicts when files have been modified outside the session

### Inline AI Editing

Allow users to invoke AI editing directly in the Obsidian editor, without switching to the chat sidebar. Select text, trigger a command, and get inline suggestions.

- [ ] Add editor command for inline AI edit (selection-based)
- [ ] Design inline suggestion UI (diff preview in editor)
- [ ] Route inline edit requests through existing ACP session
- [ ] Accept/reject inline changes with undo support

### New Mention Panel

Replace the current `SuggestionDropdown` for `@` mentions with a richer panel that supports searching, filtering, and previewing note content before attaching.

- [ ] Design panel layout (search bar, file tree, preview pane)
- [ ] Support filtering by folder, tag, or file type
- [ ] Show note preview on hover/select
- [ ] Support multi-select for attaching multiple notes at once

### New Command / MCP / Skills Panel

Add a unified panel for slash commands, MCP tools, and agent skills. Replace the current `SuggestionDropdown` for `/` commands with a categorized, searchable panel.

- [ ] Design unified panel with categories (commands, MCP tools, skills)
- [ ] Support search/filter across all categories
- [ ] Show tool descriptions and parameter hints
- [ ] Integrate MCP tool discovery from connected servers

### Settings Migration (Post-1.0.0)

Pre-1.0.0: clean break on schema mismatch (settings reset to defaults). Post-1.0.0: proper field-level migrations.

- [ ] Design migration framework (registry of version transformers)
- [ ] Implement version-to-version migrations (vN -> vN+1)
- [ ] Add migration tests for each schema change
- [ ] Graceful degradation on partial migration failure
