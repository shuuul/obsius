const MODE_ICON_MAP: Record<string, string> = {
	agent: "bot",
	build: "hammer",
	plan: "map",
	ask: "message-circle",
	debug: "bug",
	code: "code-2",
	edit: "pencil",
	review: "eye",
	test: "flask-conical",
	chat: "messages-square",
};

const FALLBACK_ICONS = ["sparkles", "wand-2", "zap", "star", "circle-dot"];

/**
 * Get the Lucide icon name for a given mode ID.
 * Uses a fixed mapping for known modes, with deterministic fallbacks
 * for unknown modes based on their index in the available modes list.
 */
export function getModeIcon(modeId: string, index: number): string {
	const normalized = modeId.toLowerCase();
	if (normalized in MODE_ICON_MAP) return MODE_ICON_MAP[normalized];
	return FALLBACK_ICONS[index % FALLBACK_ICONS.length];
}

const MODEL_ICON_PATTERNS: [RegExp, string][] = [
	[/opus/i, "gem"],
	[/sonnet/i, "music"],
	[/haiku/i, "feather"],
	[/claude/i, "sparkles"],
	[/gpt/i, "brain"],
	[/codex/i, "code-2"],
	[/gemini/i, "star"],
	[/llama/i, "flame"],
	[/mistral/i, "wind"],
	[/deepseek/i, "search"],
	[/qwen/i, "layers"],
];

/**
 * Get the Lucide icon name for a given model.
 * Matches against known model name patterns (checked against both ID and display name).
 */
export function getModelIcon(modelId: string, modelName: string): string {
	const combined = `${modelId} ${modelName}`;
	for (const [pattern, icon] of MODEL_ICON_PATTERNS) {
		if (pattern.test(combined)) return icon;
	}
	return "cpu";
}

/**
 * Maps agent ID / display name patterns to @lobehub/icons CDN slugs.
 */
const AGENT_SLUG_PATTERNS: [RegExp, string][] = [
	[/claude/i, "claudecode"],
	[/codex/i, "codex"],
	[/gemini/i, "gemini"],
	[/opencode/i, "opencode"],
	[/amp\b/i, "amp"],
	[/cline/i, "cline"],
	[/cursor/i, "cursor"],
];

/**
 * Get the @lobehub/icons CDN slug for a given agent.
 * Returns null if no matching icon is found.
 */
export function getAgentSlug(
	agentId: string,
	displayName: string,
): string | null {
	const combined = `${agentId} ${displayName}`;
	for (const [pattern, slug] of AGENT_SLUG_PATTERNS) {
		if (pattern.test(combined)) return slug;
	}
	return null;
}

const AGENT_FALLBACK_ICONS: [RegExp, string][] = [
	[/claude/i, "sparkles"],
	[/codex/i, "code-2"],
	[/gemini/i, "star"],
	[/opencode/i, "terminal"],
];

/**
 * Get a Lucide fallback icon for agents without a lobe-icons slug.
 */
export function getAgentFallbackIcon(
	agentId: string,
	displayName: string,
): string {
	const combined = `${agentId} ${displayName}`;
	for (const [pattern, icon] of AGENT_FALLBACK_ICONS) {
		if (pattern.test(combined)) return icon;
	}
	return "bot";
}

/**
 * Maps provider name patterns to @lobehub/icons CDN slugs.
 * Slugs correspond to SVG filenames at:
 *   https://unpkg.com/@lobehub/icons-static-svg@latest/icons/{slug}.svg
 */
const PROVIDER_SLUG_PATTERNS: [RegExp, string][] = [
	[/github\s*copilot/i, "githubcopilot"],
	[/github/i, "github"],
	[/openai/i, "openai"],
	[/anthropic/i, "anthropic"],
	[/google/i, "google"],
	[/gemini/i, "gemini"],
	[/minimax/i, "minimax"],
	[/meta\b/i, "meta"],
	[/mistral/i, "mistral"],
	[/deepseek/i, "deepseek"],
	[/alibaba|qwen/i, "qwen"],
	[/cohere/i, "cohere"],
	[/xai|grok/i, "xai"],
	[/amazon|bedrock/i, "bedrock"],
	[/azure/i, "azure"],
	[/groq/i, "groq"],
	[/ollama/i, "ollama"],
	[/nvidia/i, "nvidia"],
	[/perplexity/i, "perplexity"],
	[/huggingface|hf\b/i, "huggingface"],
	[/together/i, "together"],
	[/fireworks/i, "fireworks"],
	[/sambanova/i, "sambanova"],
	[/cerebras/i, "cerebras"],
	[/cloudflare/i, "cloudflare"],
	[/replicate/i, "replicate"],
	[/moonshot/i, "moonshot"],
	[/zhipu/i, "zhipu"],
	[/baichuan/i, "baichuan"],
	[/volcengine/i, "volcengine"],
	[/bytedance|doubao/i, "bytedance"],
	[/tencent/i, "tencentcloud"],
	[/siliconflow|siliconcloud/i, "siliconcloud"],
];

export interface ParsedModelDisplay {
	provider: string | null;
	modelName: string;
	/** @lobehub/icons CDN slug (null if provider not recognized) */
	providerSlug: string | null;
	/** Lucide fallback icon name */
	fallbackIcon: string;
}

/**
 * Parse a model display name into provider and model parts.
 * Handles "Provider/ModelName" format — extracts a CDN slug for the provider logo
 * and returns only the model portion as the display name.
 * Falls back to model-family icon matching when no provider prefix is found.
 */
export function parseModelDisplay(
	modelId: string,
	modelName: string,
): ParsedModelDisplay {
	const slashIndex = modelName.indexOf("/");
	if (slashIndex === -1) {
		return {
			provider: null,
			modelName,
			providerSlug: null,
			fallbackIcon: getModelIcon(modelId, modelName),
		};
	}

	const provider = modelName.substring(0, slashIndex).trim();
	const name = modelName.substring(slashIndex + 1).trim();

	for (const [pattern, slug] of PROVIDER_SLUG_PATTERNS) {
		if (pattern.test(provider)) {
			return {
				provider,
				modelName: name,
				providerSlug: slug,
				fallbackIcon: getModelIcon(modelId, name),
			};
		}
	}

	return {
		provider,
		modelName: name,
		providerSlug: null,
		fallbackIcon: getModelIcon(modelId, name),
	};
}
