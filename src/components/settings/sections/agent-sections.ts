import { Setting } from "obsidian";
import type AgentClientPlugin from "../../../plugin";
import type {
	AgentEnvVar,
	CustomAgentSettings,
} from "../../../plugin";
import { normalizeEnvVars } from "../../../shared/settings-utils";

const formatArgs = (args: string[]): string => args.join("\n");

const parseArgs = (value: string): string[] =>
	value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

const formatEnv = (env: AgentEnvVar[]): string =>
	env.map((entry) => `${entry.key}=${entry.value ?? ""}`).join("\n");

const parseEnv = (value: string): AgentEnvVar[] => {
	const envVars: AgentEnvVar[] = [];
	for (const line of value.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		const delimiter = trimmed.indexOf("=");
		if (delimiter === -1) {
			continue;
		}
		const key = trimmed.slice(0, delimiter).trim();
		const envValue = trimmed.slice(delimiter + 1).trim();
		if (!key) {
			continue;
		}
		envVars.push({ key, value: envValue });
	}
	return normalizeEnvVars(envVars);
};

const generateCustomAgentDisplayName = (plugin: AgentClientPlugin): string => {
	const base = "Custom agent";
	const existing = new Set<string>();
	existing.add(
		plugin.settings.claude.displayName || plugin.settings.claude.id,
	);
	existing.add(
		plugin.settings.opencode.displayName || plugin.settings.opencode.id,
	);
	existing.add(
		plugin.settings.codex.displayName || plugin.settings.codex.id,
	);
	existing.add(
		plugin.settings.gemini.displayName || plugin.settings.gemini.id,
	);
	for (const item of plugin.settings.customAgents) {
		existing.add(item.displayName || item.id);
	}
	if (!existing.has(base)) {
		return base;
	}
	let counter = 2;
	let candidate = `${base} ${counter}`;
	while (existing.has(candidate)) {
		counter += 1;
		candidate = `${base} ${counter}`;
	}
	return candidate;
};

const generateCustomAgentId = (plugin: AgentClientPlugin): string => {
	const base = "custom-agent";
	const existing = new Set(plugin.settings.customAgents.map((item) => item.id));
	if (!existing.has(base)) {
		return base;
	}
	let counter = 2;
	let candidate = `${base}-${counter}`;
	while (existing.has(candidate)) {
		counter += 1;
		candidate = `${base}-${counter}`;
	}
	return candidate;
};

export const getAgentOptions = (
	plugin: AgentClientPlugin,
): { id: string; label: string }[] => {
	const toOption = (id: string, displayName: string) => ({
		id,
		label: `${displayName} (${id})`,
	});

	const options: { id: string; label: string }[] = [
		toOption(
			plugin.settings.claude.id,
			plugin.settings.claude.displayName || plugin.settings.claude.id,
		),
		toOption(
			plugin.settings.opencode.id,
			plugin.settings.opencode.displayName || plugin.settings.opencode.id,
		),
		toOption(
			plugin.settings.codex.id,
			plugin.settings.codex.displayName || plugin.settings.codex.id,
		),
		toOption(
			plugin.settings.gemini.id,
			plugin.settings.gemini.displayName || plugin.settings.gemini.id,
		),
	];

	for (const agent of plugin.settings.customAgents) {
		if (!agent.id || agent.id.length === 0) {
			continue;
		}
		const labelSource =
			agent.displayName && agent.displayName.length > 0
				? agent.displayName
				: agent.id;
		options.push(toOption(agent.id, labelSource));
	}

	const seen = new Set<string>();
	return options.filter(({ id }) => {
		if (seen.has(id)) {
			return false;
		}
		seen.add(id);
		return true;
	});
};

export const renderBuiltInAgentSettings = (
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
): void => {
	renderClaudeSettings(containerEl, plugin);
	renderOpenCodeSettings(containerEl, plugin);
	renderCodexSettings(containerEl, plugin);
	renderGeminiSettings(containerEl, plugin);
};

function renderGeminiSettings(
	sectionEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	const gemini = plugin.settings.gemini;

	new Setting(sectionEl).setName(gemini.displayName || "Gemini CLI").setHeading();

	new Setting(sectionEl)
		.setName("API key")
		.setDesc(
			"Gemini API key. Required if not logging in with a Google account. (stored as plain text)",
		)
		.addText((text) => {
			text.setPlaceholder("Enter your Gemini API key")
				.setValue(gemini.apiKey)
				.onChange(async (value) => {
					plugin.settings.gemini.apiKey = value.trim();
					await plugin.saveSettings();
				});
			text.inputEl.type = "password";
		});

	new Setting(sectionEl)
		.setName("Path")
		.setDesc(
			'Absolute path to the Gemini CLI. On macOS/Linux, use "which gemini", and on Windows, use "where gemini" to find it.', // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addText((text) => {
			text.setPlaceholder("Absolute path to Gemini CLI")
				.setValue(gemini.command)
				.onChange(async (value) => {
					plugin.settings.gemini.command = value.trim();
					await plugin.saveSettings();
				});
		});

	new Setting(sectionEl)
		.setName("Arguments")
		.setDesc(
			'Enter one argument per line. Leave empty to run without arguments. (Currently, the Gemini CLI requires the "--experimental-acp" option.)', // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text.setPlaceholder("")
				.setValue(formatArgs(gemini.args))
				.onChange(async (value) => {
					plugin.settings.gemini.args = parseArgs(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});

	new Setting(sectionEl)
		.setName("Environment variables")
		.setDesc(
			"Enter KEY=VALUE pairs, one per line. Required to authenticate with Vertex AI. GEMINI_API_KEY is derived from the field above. (stored as plain text)", // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text.setPlaceholder("GOOGLE_CLOUD_PROJECT=...") // eslint-disable-line obsidianmd/ui/sentence-case
				.setValue(formatEnv(gemini.env))
				.onChange(async (value) => {
					plugin.settings.gemini.env = parseEnv(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});
}

function renderClaudeSettings(
	sectionEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	const claude = plugin.settings.claude;

	new Setting(sectionEl)
		.setName(claude.displayName || "Claude Code (ACP)")
		.setHeading();

	new Setting(sectionEl)
		.setName("API key")
		.setDesc(
			"Anthropic API key. Required if not logging in with an Anthropic account. (stored as plain text)",
		)
		.addText((text) => {
			text.setPlaceholder("Enter your Anthropic API key")
				.setValue(claude.apiKey)
				.onChange(async (value) => {
					plugin.settings.claude.apiKey = value.trim();
					await plugin.saveSettings();
				});
			text.inputEl.type = "password";
		});

	new Setting(sectionEl)
		.setName("Path")
		.setDesc(
			'Absolute path to the claude-agent-acp. On macOS/Linux, use "which claude-agent-acp", and on Windows, use "where claude-agent-acp" to find it.',
		)
		.addText((text) => {
			text.setPlaceholder("Absolute path to Claude Code")
				.setValue(claude.command)
				.onChange(async (value) => {
					plugin.settings.claude.command = value.trim();
					await plugin.saveSettings();
				});
		});

	new Setting(sectionEl)
		.setName("Arguments")
		.setDesc("Enter one argument per line. Leave empty to run without arguments.")
		.addTextArea((text) => {
			text.setPlaceholder("")
				.setValue(formatArgs(claude.args))
				.onChange(async (value) => {
					plugin.settings.claude.args = parseArgs(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});

	new Setting(sectionEl)
		.setName("Environment variables")
		.setDesc(
			"Enter KEY=VALUE pairs, one per line. ANTHROPIC_API_KEY is derived from the field above.", // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text.setPlaceholder("")
				.setValue(formatEnv(claude.env))
				.onChange(async (value) => {
					plugin.settings.claude.env = parseEnv(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});
}

function renderOpenCodeSettings(
	sectionEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	const opencode = plugin.settings.opencode;

	new Setting(sectionEl)
		.setName(opencode.displayName || "OpenCode")
		.setHeading();

	new Setting(sectionEl)
		.setName("Path")
		.setDesc(
			'Absolute path to the opencode-ai binary. On macOS/Linux, use "which opencode-ai", and on Windows, use "where opencode-ai" to find it.',
		)
		.addText((text) => {
			text.setPlaceholder("Absolute path to OpenCode") // eslint-disable-line obsidianmd/ui/sentence-case
				.setValue(opencode.command)
				.onChange(async (value) => {
					plugin.settings.opencode.command = value.trim();
					await plugin.saveSettings();
				});
		});

	new Setting(sectionEl)
		.setName("Arguments")
		.setDesc(
			'Enter one argument per line. Leave empty to run without arguments. (The "acp" argument is required for ACP mode.)', // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text.setPlaceholder("")
				.setValue(formatArgs(opencode.args))
				.onChange(async (value) => {
					plugin.settings.opencode.args = parseArgs(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});

	new Setting(sectionEl)
		.setName("Environment variables")
		.setDesc(
			"Enter KEY=VALUE pairs, one per line. (stored as plain text)", // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text.setPlaceholder("")
				.setValue(formatEnv(opencode.env))
				.onChange(async (value) => {
					plugin.settings.opencode.env = parseEnv(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});
}

function renderCodexSettings(
	sectionEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	const codex = plugin.settings.codex;

	new Setting(sectionEl).setName(codex.displayName || "Codex").setHeading();

	new Setting(sectionEl)
		.setName("API key")
		.setDesc(
			"OpenAI API key. Required if not logging in with an OpenAI account. (stored as plain text)",
		)
		.addText((text) => {
			text.setPlaceholder("Enter your OpenAI API key")
				.setValue(codex.apiKey)
				.onChange(async (value) => {
					plugin.settings.codex.apiKey = value.trim();
					await plugin.saveSettings();
				});
			text.inputEl.type = "password";
		});

	new Setting(sectionEl)
		.setName("Path")
		.setDesc(
			'Absolute path to the codex-acp. On macOS/Linux, use "which codex-acp", and on Windows, use "where codex-acp" to find it.', // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addText((text) => {
			text.setPlaceholder("Absolute path to Codex")
				.setValue(codex.command)
				.onChange(async (value) => {
					plugin.settings.codex.command = value.trim();
					await plugin.saveSettings();
				});
		});

	new Setting(sectionEl)
		.setName("Arguments")
		.setDesc("Enter one argument per line. Leave empty to run without arguments.")
		.addTextArea((text) => {
			text.setPlaceholder("")
				.setValue(formatArgs(codex.args))
				.onChange(async (value) => {
					plugin.settings.codex.args = parseArgs(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});

	new Setting(sectionEl)
		.setName("Environment variables")
		.setDesc(
			"Enter KEY=VALUE pairs, one per line. OPENAI_API_KEY is derived from the field above.", // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text.setPlaceholder("")
				.setValue(formatEnv(codex.env))
				.onChange(async (value) => {
					plugin.settings.codex.env = parseEnv(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});
}

export const renderCustomAgents = (
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	options: {
		onRefreshDropdown: () => void;
		onRedisplay: () => void;
	},
): void => {
	if (plugin.settings.customAgents.length === 0) {
		containerEl.createEl("p", {
			text: "No custom agents configured yet.",
		});
	} else {
		plugin.settings.customAgents.forEach((agent, index) => {
			renderCustomAgent(containerEl, plugin, agent, index, options);
		});
	}

	new Setting(containerEl).addButton((button) => {
		button
			.setButtonText("Add custom agent")
			.setCta()
			.onClick(async () => {
				const newId = generateCustomAgentId(plugin);
				const newDisplayName = generateCustomAgentDisplayName(plugin);
				plugin.settings.customAgents.push({
					id: newId,
					displayName: newDisplayName,
					command: "",
					args: [],
					env: [],
				});
				plugin.ensureDefaultAgentId();
				await plugin.saveSettings();
				options.onRedisplay();
			});
	});
};

function renderCustomAgent(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	agent: CustomAgentSettings,
	index: number,
	options: { onRefreshDropdown: () => void; onRedisplay: () => void },
): void {
	const blockEl = containerEl.createDiv({
		cls: "agent-client-custom-agent",
	});

	const idSetting = new Setting(blockEl)
		.setName("Agent ID")
		.setDesc("Unique identifier used to reference this agent.")
		.addText((text) => {
			text.setPlaceholder("custom-agent") // eslint-disable-line obsidianmd/ui/sentence-case
				.setValue(agent.id)
				.onChange(async (value) => {
					const previousId = plugin.settings.customAgents[index].id;
					const trimmed = value.trim();
					let nextId = trimmed;
					if (nextId.length === 0) {
						nextId = generateCustomAgentId(plugin);
						text.setValue(nextId);
					}
					plugin.settings.customAgents[index].id = nextId;
					if (plugin.settings.defaultAgentId === previousId) {
						plugin.settings.defaultAgentId = nextId;
					}
					plugin.ensureDefaultAgentId();
					await plugin.saveSettings();
					options.onRefreshDropdown();
				});
		});

	idSetting.addExtraButton((button) => {
		button.setIcon("trash").setTooltip("Delete this agent").onClick(async () => {
			plugin.settings.customAgents.splice(index, 1);
			plugin.ensureDefaultAgentId();
			await plugin.saveSettings();
			options.onRedisplay();
		});
	});

	new Setting(blockEl)
		.setName("Display name")
		.setDesc("Shown in menus and headers.")
		.addText((text) => {
			text.setPlaceholder("Custom agent")
				.setValue(agent.displayName || agent.id)
				.onChange(async (value) => {
					const trimmed = value.trim();
					plugin.settings.customAgents[index].displayName =
						trimmed.length > 0 ? trimmed : plugin.settings.customAgents[index].id;
					await plugin.saveSettings();
					options.onRefreshDropdown();
				});
		});

	new Setting(blockEl)
		.setName("Path")
		.setDesc("Absolute path to the custom agent.")
		.addText((text) => {
			text.setPlaceholder("Absolute path to custom agent")
				.setValue(agent.command)
				.onChange(async (value) => {
					plugin.settings.customAgents[index].command = value.trim();
					await plugin.saveSettings();
				});
		});

	new Setting(blockEl)
		.setName("Arguments")
		.setDesc("Enter one argument per line. Leave empty to run without arguments.")
		.addTextArea((text) => {
			text.setPlaceholder("--flag\n--another=value")
				.setValue(formatArgs(agent.args))
				.onChange(async (value) => {
					plugin.settings.customAgents[index].args = parseArgs(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});

	new Setting(blockEl)
		.setName("Environment variables")
		.setDesc("Enter KEY=VALUE pairs, one per line. (stored as plain text)") // eslint-disable-line obsidianmd/ui/sentence-case
		.addTextArea((text) => {
			text.setPlaceholder("TOKEN=...") // eslint-disable-line obsidianmd/ui/sentence-case
				.setValue(formatEnv(agent.env))
				.onChange(async (value) => {
					plugin.settings.customAgents[index].env = parseEnv(value);
					await plugin.saveSettings();
				});
			text.inputEl.rows = 3;
		});
}
