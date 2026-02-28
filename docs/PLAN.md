# Remaining Problems Backlog

Last updated: 2026-03-01

## P0 Maintainability Hotspots (>600 LOC)
- `src/components/chat/ChatView.tsx` (~880 LOC)
- `src/components/chat/FloatingChatView.tsx` (~820 LOC)
- `src/components/chat/ToolCallRenderer.tsx` (~692 LOC)

## P1 Lint Policy Debt
- `obsidianmd/ui/sentence-case`: 54 warnings still open.
- Required policy completion:
  - normalize user-facing labels to sentence case
  - add a narrow allowlist only for proper nouns (Claude Code, Gemini CLI, Codex)

## P1 Documentation Drift
- Keep architecture docs synchronized after each decomposition step:
  - `AGENTS.md`
  - `src/hooks/AGENTS.md`
  - `src/components/chat/AGENTS.md`
  - `.github/copilot-instructions.md`

## P2 Legacy Surface Audit (ongoing)
- Continue removing dead legacy artifacts when they are confirmed unused.
- Completed in this pass:
  - removed `esbuild.config.mjs` (obsolete after Vite migration)
  - removed broken docs media embeds that referenced deleted `docs/public/*` assets

## Definition of Done For This Backlog
- No core source file above 600 LOC.
- `npm run lint` has zero errors and zero warnings.
- `npm run typecheck`, `npm run test`, `npm run build`, `npm run docs:build` all pass after each refactor slice.
