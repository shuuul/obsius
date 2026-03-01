import { App, PluginSettingTab, Setting, DropdownComponent } from "obsidian";
import type AgentClientPlugin from "../../plugin";
import {
	getAgentOptions,
	renderBuiltInAgentSettings,
} from "./sections/agent-sections";
import { renderCustomAgents } from "./sections/custom-agent-sections";
import { renderCoreSections } from "./sections/core-sections";

export class AgentClientSettingTab extends PluginSettingTab {
	plugin: AgentClientPlugin;
	private agentSelector: DropdownComponent | null = null;
	private unsubscribe: (() => void) | null = null;

	constructor(app: App, plugin: AgentClientPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		this.agentSelector = null;

		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		this.renderAgentSelector(containerEl);
		this.unsubscribe = this.plugin.settingsStore.subscribe(() => {
			this.updateAgentDropdown();
		});
		this.updateAgentDropdown();

		renderCoreSections(containerEl, this.plugin, () => this.display());

		new Setting(containerEl).setName("Built-in agents").setHeading();
		renderBuiltInAgentSettings(containerEl, this.plugin);

		new Setting(containerEl).setName("Custom agents").setHeading();
		renderCustomAgents(containerEl, this.plugin, {
			onRefreshDropdown: () => this.refreshAgentDropdown(),
			onRedisplay: () => this.display(),
		});
	}

	hide(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	private updateAgentDropdown(): void {
		if (!this.agentSelector) {
			return;
		}

		const settings = this.plugin.settingsStore.getSnapshot();
		const currentValue = this.agentSelector.getValue();
		if (settings.defaultAgentId !== currentValue) {
			this.agentSelector.setValue(settings.defaultAgentId);
		}
	}

	private renderAgentSelector(containerEl: HTMLElement): void {
		this.plugin.ensureDefaultAgentId();

		new Setting(containerEl)
			.setName("Default agent")
			.setDesc("Choose which agent is used when opening a new chat view.")
			.addDropdown((dropdown) => {
				this.agentSelector = dropdown;
				this.populateAgentDropdown(dropdown);
				dropdown.setValue(this.plugin.settings.defaultAgentId);
				dropdown.onChange(async (value) => {
					await this.plugin.settingsStore.updateSettings({
						defaultAgentId: value,
					});
					this.plugin.ensureDefaultAgentId();
				});
			});
	}

	private populateAgentDropdown(dropdown: DropdownComponent): void {
		dropdown.selectEl.empty();
		for (const option of getAgentOptions(this.plugin)) {
			dropdown.addOption(option.id, option.label);
		}
	}

	private refreshAgentDropdown(): void {
		if (!this.agentSelector) {
			return;
		}
		this.populateAgentDropdown(this.agentSelector);
		this.agentSelector.setValue(this.plugin.settings.defaultAgentId);
	}
}
