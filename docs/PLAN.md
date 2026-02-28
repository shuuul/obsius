# Re-Architecture Plan (Divergent Fork)

Last updated: 2026-03-01

## Goal
Improve maintainability and iteration speed while preserving behavior at plugin/hook boundaries.

## Strategy
- Mainline phased delivery (no long-lived mega-branch)
- Reducer-first deterministic state transitions
- ACP adapter decomposition by concern
- Strict quality gates (`typecheck`, `lint`, `test`, `build`, `docs:build`)
- Intentional clean break for incompatible persisted schemas

## Phase Status

### Phase 1: Platform Baseline Reset
Status: Done
- Node floor set to `>=20.19.0`
- Obsidian floor set to `>=1.5.0` (`manifest.json`, `versions.json`)
- Build migrated to Vite (`vite.config.ts`)
- Tests added with Vitest + jsdom (`vitest.config.ts`, `test/*`)
- Biome introduced with ESLint retained for TS/Obsidian rules
- CI pipeline now enforces typecheck/lint/test/build/docs

### Phase 2: Deterministic State Architecture
Status: Done (first scope)
- Added reducer/action modules under `src/hooks/state/`
- Migrated `useChat`, `useAgentSession`, `usePermission` to reducer-driven transitions
- Added reducer-focused unit tests

### Phase 3: ACP Adapter Decomposition
Status: In progress (major split completed)
- `src/adapters/acp/acp.adapter.ts` reduced to composition root (~516 LOC)
- Extracted:
  - `process-lifecycle.ts`
  - `runtime-ops.ts`
  - `session-ops.ts`
  - `permission-queue.ts`
  - `terminal-bridge.ts`
  - `update-routing.ts`
  - `error-diagnostics.ts`

### Phase 4: Plugin and Settings Refactor + Clean Break
Status: In progress
- `src/plugin.ts` reduced to orchestrator (~545 LOC)
- Extracted plugin modules:
  - `src/plugin/agent-ops.ts`
  - `src/plugin/update-check.ts`
  - `src/plugin/view-helpers.ts`
- Settings UI split into section modules:
  - `src/components/settings/sections/core-sections.ts`
  - `src/components/settings/sections/agent-sections.ts`
  - `src/components/settings/AgentClientSettingTab.ts` reduced to coordinator (~118 LOC)
- Added Zod runtime schema boundary for settings and session payloads
- Clean break behavior implemented on incompatible persisted data
- `src/hooks/useChatController.ts` reduced to ~570 LOC
- Extracted session-history controller module:
  - `src/hooks/chat-controller/session-history-handlers.ts`

### Phase 5: Strict Quality Gates and Maintainer UX
Status: In progress
- Added architecture checks:
  - file-size budget check
  - domain import boundary check
- Dependabot weekly config added
- Remaining work:
  - normalize sentence-case warnings
  - continue decomposing remaining >600 LOC files

## Current Validation Snapshot
- `npm run typecheck`: pass
- `npm run lint`: pass with warnings only (`obsidianmd/ui/sentence-case`)
- `npm run test`: pass
- `npm run build`: pass
- `npm run docs:build`: pass

## Remaining Large Files (next targets)
- `src/components/chat/ChatView.tsx`
- `src/components/chat/FloatingChatView.tsx`
- `src/components/chat/ToolCallRenderer.tsx`

## Risks and Controls
- Risk: behavioral drift during module extraction
  - Control: preserve public hook outputs and `IAgentClient` surface; keep adapter/plugin as composition roots
- Risk: migration confusion for old local state
  - Control: explicit clean-reset notice and schema versioning
- Risk: monolith regression
  - Control: file-size budget in lint architecture step
