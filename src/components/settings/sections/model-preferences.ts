import { Setting, setIcon } from "obsidian";
import type AgentClientPlugin from "../../../plugin";

interface CachedModel {
	modelId: string;
	name: string;
	description?: string;
}

interface CachedMode {
	id: string;
	name: string;
	description?: string;
}

const pickerCleanup = new WeakMap<HTMLElement, () => void>();

/**
 * Render candidate-model picker + mode-model mapping for a single agent.
 * Called from each agent's settings section (after env vars).
 */
export function renderAgentModelSettings(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	agentId: string,
): void {
	const models = plugin.settings.cachedAgentModels?.[agentId];
	if (!models || models.length === 0) return;

	renderCandidateModelPicker(containerEl, plugin, agentId, models);

	const modes = plugin.settings.cachedAgentModes?.[agentId];
	if (modes && modes.length > 0) {
		renderModeModelMapping(containerEl, plugin, agentId, modes, models);
	}
}

// ============================================================================
// Candidate Model Picker
// ============================================================================

function renderCandidateModelPicker(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	agentId: string,
	models: CachedModel[],
): void {
	const wrapper = containerEl.createDiv({
		cls: "agent-client-model-prefs-agent",
	});

	const candidates = (plugin.settings.candidateModels?.[agentId] ?? []).filter(
		(id) => models.some((m) => m.modelId === id),
	);

	const headerSetting = new Setting(wrapper)
		.setName("Candidate models")
		.setDesc(
			candidates.length > 0
				? "Only these models appear in the chat selector."
				: `All ${models.length} models are available. Add candidates to filter the chat selector.`,
		);

	const chipsEl = wrapper.createDiv({
		cls: `agent-client-model-chips${candidates.length === 0 ? " is-hidden" : ""}`,
	});
	if (candidates.length > 0) {
		refreshChips(chipsEl, plugin, agentId, models, () =>
			updateDescription(headerSetting, chipsEl, plugin, agentId, models),
		);
	}

	headerSetting.addExtraButton((btn) => {
		btn.setIcon("plus").setTooltip("Add model");
		btn.onClick(() => {
			togglePicker(wrapper, plugin, agentId, models, () => {
				updateDescription(headerSetting, chipsEl, plugin, agentId, models);
			});
		});
	});
}

function updateDescription(
	headerSetting: Setting,
	chipsEl: HTMLElement,
	plugin: AgentClientPlugin,
	agentId: string,
	models: CachedModel[],
): void {
	const updated = (plugin.settings.candidateModels?.[agentId] ?? []).filter(
		(id) => models.some((m) => m.modelId === id),
	);

	refreshChips(chipsEl, plugin, agentId, models, () =>
		updateDescription(headerSetting, chipsEl, plugin, agentId, models),
	);

	if (updated.length > 0) {
		chipsEl.removeClass("is-hidden");
		headerSetting.setDesc("Only these models appear in the chat selector.");
	} else {
		chipsEl.addClass("is-hidden");
		headerSetting.setDesc(
			`All ${models.length} models are available. Add candidates to filter the chat selector.`,
		);
	}
}

function refreshChips(
	chipsEl: HTMLElement,
	plugin: AgentClientPlugin,
	agentId: string,
	models: CachedModel[],
	onUpdate: () => void,
): void {
	chipsEl.empty();
	const candidates = (plugin.settings.candidateModels?.[agentId] ?? []).filter(
		(id) => models.some((m) => m.modelId === id),
	);

	for (const modelId of candidates) {
		const model = models.find((m) => m.modelId === modelId);
		const chip = chipsEl.createDiv({ cls: "agent-client-model-chip" });
		chip.createSpan({
			text: model?.name ?? modelId,
			cls: "agent-client-model-chip-label",
		});
		const removeBtn = chip.createSpan({
			text: "\u00d7",
			cls: "agent-client-model-chip-remove",
			attr: { "aria-label": `Remove ${model?.name ?? modelId}` },
		});
		removeBtn.addEventListener("click", () => {
			const current = plugin.settings.candidateModels?.[agentId] ?? [];
			void plugin.settingsStore.updateSettings({
				candidateModels: {
					...plugin.settings.candidateModels,
					[agentId]: current.filter((id) => id !== modelId),
				},
			});
			onUpdate();
		});
	}
}

function destroyPicker(picker: HTMLElement): void {
	const cleanup = pickerCleanup.get(picker);
	if (cleanup) {
		cleanup();
		pickerCleanup.delete(picker);
	}
	picker.remove();
}

function togglePicker(
	wrapper: HTMLElement,
	plugin: AgentClientPlugin,
	agentId: string,
	models: CachedModel[],
	onUpdate: () => void,
): void {
	const existing: HTMLElement | null = wrapper.querySelector(
		".agent-client-model-picker",
	);
	if (existing) {
		destroyPicker(existing);
		return;
	}

	const picker = wrapper.createDiv({ cls: "agent-client-model-picker" });

	const searchEl = picker.createEl("input", {
		type: "text",
		placeholder: "Filter models...",
		cls: "agent-client-model-picker-search",
	});

	const listEl = picker.createDiv({ cls: "agent-client-model-picker-list" });

	const renderList = (query: string) => {
		listEl.empty();
		const lowerQuery = query.toLowerCase();
		const currentCandidates = plugin.settings.candidateModels?.[agentId] ?? [];

		const filtered = models.filter((m) => {
			if (query.length === 0) return true;
			return (
				m.modelId.toLowerCase().includes(lowerQuery) ||
				m.name.toLowerCase().includes(lowerQuery) ||
				(m.description?.toLowerCase().includes(lowerQuery) ?? false)
			);
		});

		if (filtered.length === 0) {
			listEl.createDiv({
				text: "No matching models.",
				cls: "agent-client-model-picker-empty",
			});
			return;
		}

		for (const model of filtered) {
			const isSelected = currentCandidates.includes(model.modelId);
			const item = listEl.createDiv({
				cls: `agent-client-model-picker-item${isSelected ? " is-selected" : ""}`,
			});

			const checkEl = item.createSpan({
				cls: "agent-client-model-picker-check",
			});
			if (isSelected) {
				setIcon(checkEl, "check");
			}

			const textEl = item.createDiv({
				cls: "agent-client-model-picker-item-text",
			});
			textEl.createSpan({
				text: model.name,
				cls: "agent-client-model-picker-item-name",
			});
			if (model.description) {
				textEl.createSpan({
					text: model.description,
					cls: "agent-client-model-picker-item-desc",
				});
			}

			item.addEventListener("click", () => {
				const current = plugin.settings.candidateModels?.[agentId] ?? [];
				const next = isSelected
					? current.filter((id) => id !== model.modelId)
					: [...current, model.modelId];
				void plugin.settingsStore.updateSettings({
					candidateModels: {
						...plugin.settings.candidateModels,
						[agentId]: next,
					},
				});
				renderList(searchEl.value.trim());
				onUpdate();
			});
		}
	};

	searchEl.addEventListener("input", () => {
		renderList(searchEl.value.trim());
	});

	const onClickOutside = (e: MouseEvent) => {
		if (!picker.contains(e.target as Node)) {
			destroyPicker(picker);
		}
	};
	document.addEventListener("mousedown", onClickOutside, true);
	pickerCleanup.set(picker, () => {
		document.removeEventListener("mousedown", onClickOutside, true);
	});

	renderList("");
	searchEl.focus();
}

// ============================================================================
// Mode → Model Mapping
// ============================================================================

function renderModeModelMapping(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	agentId: string,
	modes: CachedMode[],
	models: CachedModel[],
): void {
	new Setting(containerEl)
		.setName("Model per mode")
		.setDesc(
			"Optionally assign a default model for each mode. When switching modes in chat, the model will change automatically.",
		);

	const defaults = plugin.settings.modeModelDefaults?.[agentId] ?? {};

	for (const mode of modes) {
		new Setting(containerEl)
			.setName(mode.name)
			.setDesc(mode.description ?? "")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "(auto)");
				for (const model of models) {
					dropdown.addOption(model.modelId, model.name);
				}
				dropdown.setValue(defaults[mode.id] ?? "");
			dropdown.onChange((value) => {
				const current = plugin.settings.modeModelDefaults?.[agentId] ?? {};
				let modeDefaults: Record<string, string>;
				if (value === "") {
					modeDefaults = { ...current };
					delete modeDefaults[mode.id];
				} else {
					modeDefaults = { ...current, [mode.id]: value };
				}
				void plugin.settingsStore.updateSettings({
					modeModelDefaults: {
						...plugin.settings.modeModelDefaults,
						[agentId]: modeDefaults,
					},
				});
			});
			});
	}
}
