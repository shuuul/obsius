import { Notice, Setting, type TextComponent } from "obsidian";
import type AgentClientPlugin from "../../../plugin";
import type { AgentEnvVar, CustomAgentSettings } from "../../../plugin";
import { normalizeEnvVars } from "../../../shared/settings-utils";
import {
	BUILTIN_AGENT_DEFAULT_COMMANDS,
	resolveCommandFromShell,
} from "../../../shared/shell-utils";
import { renderAgentModelSettings } from "./model-preferences";

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
	existing.add(plugin.settings.claude.displayName || plugin.settings.claude.id);
	existing.add(
		plugin.settings.opencode.displayName || plugin.settings.opencode.id,
	);
	existing.add(plugin.settings.codex.displayName || plugin.settings.codex.id);
	existing.add(plugin.settings.gemini.displayName || plugin.settings.gemini.id);
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
		label: displayName,
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
	const store = plugin.settingsStore;

	new Setting(sectionEl)
		.setName(gemini.displayName || "Gemini CLI")
		.setHeading();

	new Setting(sectionEl)
		.setName("API key")
		.setDesc(
			"Gemini API key. Required if not logging in with a Google account. (stored as plain text)",
		)
		.addText((text) => {
			text
				.setPlaceholder("Enter your Gemini API key")
				.setValue(gemini.apiKey)
				.onChange(async (value) => {
					await store.updateSettings({
						gemini: { ...plugin.settings.gemini, apiKey: value.trim() },
					});
				});
			text.inputEl.type = "password";
		});

	renderPathSettingWithDetect(sectionEl, plugin, {
		agentId: gemini.id,
		getValue: () => plugin.settings.gemini.command,
		setValue: async (value) => {
			await store.updateSettings({
				gemini: { ...plugin.settings.gemini, command: value },
			});
		},
	});

	new Setting(sectionEl)
		.setName("Arguments")
		.setDesc(
			'Enter one argument per line. Leave empty to run without arguments. (Currently, the Gemini CLI requires the "--experimental-acp" option.)', // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text
				.setPlaceholder("")
				.setValue(formatArgs(gemini.args))
				.onChange(async (value) => {
					await store.updateSettings({
						gemini: { ...plugin.settings.gemini, args: parseArgs(value) },
					});
				});
			text.inputEl.rows = 3;
		});

	new Setting(sectionEl)
		.setName("Environment variables")
		.setDesc(
			"Enter KEY=VALUE pairs, one per line. Required to authenticate with Vertex AI. GEMINI_API_KEY is derived from the field above. (stored as plain text)", // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text
				.setPlaceholder("GOOGLE_CLOUD_PROJECT=...") // eslint-disable-line obsidianmd/ui/sentence-case
				.setValue(formatEnv(gemini.env))
				.onChange(async (value) => {
					await store.updateSettings({
						gemini: { ...plugin.settings.gemini, env: parseEnv(value) },
					});
				});
			text.inputEl.rows = 3;
		});

	renderAgentModelSettings(sectionEl, plugin, gemini.id);
}

function renderClaudeSettings(
	sectionEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	const claude = plugin.settings.claude;
	const store = plugin.settingsStore;

	new Setting(sectionEl)
		.setName(claude.displayName || "Claude Code (ACP)")
		.setHeading();

	new Setting(sectionEl)
		.setName("API key")
		.setDesc(
			"Anthropic API key. Required if not logging in with an Anthropic account. (stored as plain text)",
		)
		.addText((text) => {
			text
				.setPlaceholder("Enter your Anthropic API key")
				.setValue(claude.apiKey)
				.onChange(async (value) => {
					await store.updateSettings({
						claude: { ...plugin.settings.claude, apiKey: value.trim() },
					});
				});
			text.inputEl.type = "password";
		});

	renderPathSettingWithDetect(sectionEl, plugin, {
		agentId: claude.id,
		getValue: () => plugin.settings.claude.command,
		setValue: async (value) => {
			await store.updateSettings({
				claude: { ...plugin.settings.claude, command: value },
			});
		},
	});

	new Setting(sectionEl)
		.setName("Arguments")
		.setDesc(
			"Enter one argument per line. Leave empty to run without arguments.",
		)
		.addTextArea((text) => {
			text
				.setPlaceholder("")
				.setValue(formatArgs(claude.args))
				.onChange(async (value) => {
					await store.updateSettings({
						claude: { ...plugin.settings.claude, args: parseArgs(value) },
					});
				});
			text.inputEl.rows = 3;
		});

	new Setting(sectionEl)
		.setName("Environment variables")
		.setDesc(
			"Enter KEY=VALUE pairs, one per line. ANTHROPIC_API_KEY is derived from the field above.", // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text
				.setPlaceholder("")
				.setValue(formatEnv(claude.env))
				.onChange(async (value) => {
					await store.updateSettings({
						claude: { ...plugin.settings.claude, env: parseEnv(value) },
					});
				});
			text.inputEl.rows = 3;
		});

	renderAgentModelSettings(sectionEl, plugin, claude.id);
}

function renderOpenCodeSettings(
	sectionEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	const opencode = plugin.settings.opencode;
	const store = plugin.settingsStore;

	new Setting(sectionEl)
		.setName(opencode.displayName || "OpenCode")
		.setHeading();

	renderPathSettingWithDetect(sectionEl, plugin, {
		agentId: opencode.id,
		getValue: () => plugin.settings.opencode.command,
		setValue: async (value) => {
			await store.updateSettings({
				opencode: { ...plugin.settings.opencode, command: value },
			});
		},
	});

	new Setting(sectionEl)
		.setName("Arguments")
		.setDesc(
			'Enter one argument per line. Leave empty to run without arguments. (The "acp" argument is required for ACP mode.)', // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text
				.setPlaceholder("")
				.setValue(formatArgs(opencode.args))
				.onChange(async (value) => {
					await store.updateSettings({
						opencode: {
							...plugin.settings.opencode,
							args: parseArgs(value),
						},
					});
				});
			text.inputEl.rows = 3;
		});

	new Setting(sectionEl)
		.setName("Environment variables")
		.setDesc(
			"Enter KEY=VALUE pairs, one per line. (stored as plain text)", // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text
				.setPlaceholder("")
				.setValue(formatEnv(opencode.env))
				.onChange(async (value) => {
					await store.updateSettings({
						opencode: {
							...plugin.settings.opencode,
							env: parseEnv(value),
						},
					});
				});
			text.inputEl.rows = 3;
		});

	renderAgentModelSettings(sectionEl, plugin, opencode.id);
}

function renderCodexSettings(
	sectionEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	const codex = plugin.settings.codex;
	const store = plugin.settingsStore;

	new Setting(sectionEl).setName(codex.displayName || "Codex").setHeading();

	new Setting(sectionEl)
		.setName("API key")
		.setDesc(
			"OpenAI API key. Required if not logging in with an OpenAI account. (stored as plain text)",
		)
		.addText((text) => {
			text
				.setPlaceholder("Enter your OpenAI API key")
				.setValue(codex.apiKey)
				.onChange(async (value) => {
					await store.updateSettings({
						codex: { ...plugin.settings.codex, apiKey: value.trim() },
					});
				});
			text.inputEl.type = "password";
		});

	renderPathSettingWithDetect(sectionEl, plugin, {
		agentId: codex.id,
		getValue: () => plugin.settings.codex.command,
		setValue: async (value) => {
			await store.updateSettings({
				codex: { ...plugin.settings.codex, command: value },
			});
		},
	});

	new Setting(sectionEl)
		.setName("Arguments")
		.setDesc(
			"Enter one argument per line. Leave empty to run without arguments.",
		)
		.addTextArea((text) => {
			text
				.setPlaceholder("")
				.setValue(formatArgs(codex.args))
				.onChange(async (value) => {
					await store.updateSettings({
						codex: { ...plugin.settings.codex, args: parseArgs(value) },
					});
				});
			text.inputEl.rows = 3;
		});

	new Setting(sectionEl)
		.setName("Environment variables")
		.setDesc(
			"Enter KEY=VALUE pairs, one per line. OPENAI_API_KEY is derived from the field above.", // eslint-disable-line obsidianmd/ui/sentence-case
		)
		.addTextArea((text) => {
			text
				.setPlaceholder("")
				.setValue(formatEnv(codex.env))
				.onChange(async (value) => {
					await store.updateSettings({
						codex: { ...plugin.settings.codex, env: parseEnv(value) },
					});
				});
			text.inputEl.rows = 3;
		});

	renderAgentModelSettings(sectionEl, plugin, codex.id);
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
				await plugin.settingsStore.updateSettings({
					customAgents: [
						...plugin.settings.customAgents,
						{
							id: newId,
							displayName: newDisplayName,
							command: "",
							args: [],
							env: [],
						},
					],
				});
				plugin.ensureDefaultAgentId();
				options.onRedisplay();
			});
	});
};

function renderPathSettingWithDetect(
	containerEl: HTMLElement,
	_plugin: AgentClientPlugin,
	opts: {
		agentId: string;
		getValue: () => string;
		setValue: (value: string) => Promise<void>;
	},
): void {
	const defaultCommand = BUILTIN_AGENT_DEFAULT_COMMANDS[opts.agentId] ?? "";
	let textRef: TextComponent | null = null;

	const setting = new Setting(containerEl)
		.setName("Command")
		.setDesc(
			defaultCommand
				? `Leave empty to use "${defaultCommand}" from your shell PATH, or enter a custom path.`
				: "Command name or absolute path to the agent binary.",
		)
		.addText((text) => {
			textRef = text;
			text
				.setPlaceholder(defaultCommand || "Command name or path")
				.setValue(opts.getValue())
				.onChange(async (value) => {
					await opts.setValue(value.trim());
				});
		});

	if (defaultCommand) {
		setting.addExtraButton((button) => {
			button
				.setIcon("search")
				.setTooltip("Detect from shell PATH") // eslint-disable-line obsidianmd/ui/sentence-case
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const resolved = await resolveCommandFromShell(defaultCommand);
						if (resolved) {
							textRef?.setValue(resolved);
							await opts.setValue(resolved);
							new Notice(`Found: ${resolved}`);
						} else {
							new Notice(`"${defaultCommand}" not found in shell PATH.`);
						}
					} finally {
						button.setDisabled(false);
					}
				});
		});
	}
}

function updateCustomAgent(
	plugin: AgentClientPlugin,
	index: number,
	patch: Partial<CustomAgentSettings>,
): Promise<void> {
	const agents = plugin.settings.customAgents.map((a, i) =>
		i === index ? { ...a, ...patch } : a,
	);
	return plugin.settingsStore.updateSettings({ customAgents: agents });
}

function renderCustomAgent(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	agent: CustomAgentSettings,
	index: number,
	options: { onRefreshDropdown: () => void; onRedisplay: () => void },
): void {
	const store = plugin.settingsStore;
	const blockEl = containerEl.createDiv({
		cls: "obsius-custom-agent",
	});

	const idSetting = new Setting(blockEl)
		.setName("Agent ID")
		.setDesc("Unique identifier used to reference this agent.")
		.addText((text) => {
			text
				.setPlaceholder("custom-agent") // eslint-disable-line obsidianmd/ui/sentence-case
				.setValue(agent.id)
				.onChange(async (value) => {
					const previousId = plugin.settings.customAgents[index].id;
					const trimmed = value.trim();
					let nextId = trimmed;
					if (nextId.length === 0) {
						nextId = generateCustomAgentId(plugin);
						text.setValue(nextId);
					}
					const updates: Partial<CustomAgentSettings> = { id: nextId };
					const defaultUpdate: Partial<Record<string, unknown>> = {};
					if (plugin.settings.defaultAgentId === previousId) {
						defaultUpdate.defaultAgentId = nextId;
					}
					const agents = plugin.settings.customAgents.map((a, i) =>
						i === index ? { ...a, ...updates } : a,
					);
					await store.updateSettings({
						customAgents: agents,
						...defaultUpdate,
					});
					plugin.ensureDefaultAgentId();
					options.onRefreshDropdown();
				});
		});

	idSetting.addExtraButton((button) => {
		button
			.setIcon("trash")
			.setTooltip("Delete this agent")
			.onClick(async () => {
				const agents = plugin.settings.customAgents.filter(
					(_, i) => i !== index,
				);
				await store.updateSettings({ customAgents: agents });
				plugin.ensureDefaultAgentId();
				options.onRedisplay();
			});
	});

	new Setting(blockEl)
		.setName("Display name")
		.setDesc("Shown in menus and headers.")
		.addText((text) => {
			text
				.setPlaceholder("Custom agent")
				.setValue(agent.displayName || agent.id)
				.onChange(async (value) => {
					const trimmed = value.trim();
					const displayName =
						trimmed.length > 0
							? trimmed
							: plugin.settings.customAgents[index].id;
					await updateCustomAgent(plugin, index, { displayName });
					options.onRefreshDropdown();
				});
		});

	new Setting(blockEl)
		.setName("Command")
		.setDesc("Command name or absolute path to the agent binary.")
		.addText((text) => {
			text
				.setPlaceholder("Command name or path")
				.setValue(agent.command)
				.onChange(async (value) => {
					await updateCustomAgent(plugin, index, {
						command: value.trim(),
					});
				});
		});

	new Setting(blockEl)
		.setName("Arguments")
		.setDesc(
			"Enter one argument per line. Leave empty to run without arguments.",
		)
		.addTextArea((text) => {
			text
				.setPlaceholder("--flag\n--another=value")
				.setValue(formatArgs(agent.args))
				.onChange(async (value) => {
					await updateCustomAgent(plugin, index, {
						args: parseArgs(value),
					});
				});
			text.inputEl.rows = 3;
		});

	new Setting(blockEl)
		.setName("Environment variables")
		.setDesc("Enter KEY=VALUE pairs, one per line. (stored as plain text)") // eslint-disable-line obsidianmd/ui/sentence-case
		.addTextArea((text) => {
			text
				.setPlaceholder("TOKEN=...") // eslint-disable-line obsidianmd/ui/sentence-case
				.setValue(formatEnv(agent.env))
				.onChange(async (value) => {
					await updateCustomAgent(plugin, index, { env: parseEnv(value) });
				});
			text.inputEl.rows = 3;
		});

	renderAgentModelSettings(blockEl, plugin, agent.id);
}
