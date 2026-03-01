import type { AgentClientPluginSettings } from "../plugin";

export function resolveAgentDisplayName(
	settings: AgentClientPluginSettings,
	agentId: string,
): string {
	const builtins = [
		settings.claude,
		settings.opencode,
		settings.codex,
		settings.gemini,
	];
	for (const agent of builtins) {
		if (agent.id === agentId) {
			return agent.displayName || agent.id;
		}
	}
	const custom = settings.customAgents.find((a) => a.id === agentId);
	return custom?.displayName || custom?.id || agentId;
}
