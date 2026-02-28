import { Platform, Setting } from "obsidian";
import type AgentClientPlugin from "../../../plugin";
import type { ChatViewLocation } from "../../../plugin";
import {
	CHAT_FONT_SIZE_MAX,
	CHAT_FONT_SIZE_MIN,
	parseChatFontSize,
} from "../../../shared/display-settings";

export const renderCoreSections = (
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	redisplay: () => void,
): void => {
	new Setting(containerEl)
		.setName("Node.js path")
		.setDesc(
			'Absolute path to Node.js executable. On macOS/Linux, use "which node", and on Windows, use "where node" to find it.',
		)
		.addText((text) => {
			text.setPlaceholder("Absolute path to node")
				.setValue(plugin.settings.nodePath)
				.onChange(async (value) => {
					plugin.settings.nodePath = value.trim();
					await plugin.saveSettings();
				});
		});

	new Setting(containerEl)
		.setName("Send message shortcut")
		.setDesc(
			"Choose the keyboard shortcut to send messages. Note: If using Cmd/Ctrl+Enter, you may need to remove any hotkeys assigned to Cmd/Ctrl+Enter (Settings → Hotkeys).",
		)
		.addDropdown((dropdown) =>
			dropdown
				.addOption("enter", "Enter to send, Shift+Enter for newline")
				.addOption(
					"cmd-enter",
					"Cmd/Ctrl+Enter to send, Enter for newline",
				)
				.setValue(plugin.settings.sendMessageShortcut)
				.onChange(async (value) => {
					plugin.settings.sendMessageShortcut = value as
						| "enter"
						| "cmd-enter";
					await plugin.saveSettings();
				}),
		);

	renderMentionsSection(containerEl, plugin);
	renderDisplaySection(containerEl, plugin, redisplay);
	renderFloatingSection(containerEl, plugin);
	renderPermissionSection(containerEl, plugin);
	renderWindowsSection(containerEl, plugin, redisplay);
	renderExportSection(containerEl, plugin, redisplay);
	renderDeveloperSection(containerEl, plugin);
};

function renderMentionsSection(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	new Setting(containerEl).setName("Mentions").setHeading();

	new Setting(containerEl)
		.setName("Auto-mention active note")
		.setDesc(
			"Include the current note in your messages automatically. The agent will have access to its content without typing @notename.",
		)
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.autoMentionActiveNote)
				.onChange(async (value) => {
					plugin.settings.autoMentionActiveNote = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Max note length")
		.setDesc(
			"Maximum characters per mentioned note. Notes longer than this will be truncated.",
		)
		.addText((text) =>
			text
				.setPlaceholder("10000")
				.setValue(String(plugin.settings.displaySettings.maxNoteLength))
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 1) {
						plugin.settings.displaySettings.maxNoteLength = num;
						await plugin.saveSettings();
					}
				}),
		);

	new Setting(containerEl)
		.setName("Max selection length")
		.setDesc(
			"Maximum characters for text selection in auto-mention. Selections longer than this will be truncated.",
		)
		.addText((text) =>
			text
				.setPlaceholder("10000")
				.setValue(
					String(plugin.settings.displaySettings.maxSelectionLength),
				)
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 1) {
						plugin.settings.displaySettings.maxSelectionLength = num;
						await plugin.saveSettings();
					}
				}),
		);
}

function renderDisplaySection(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	redisplay: () => void,
): void {
	new Setting(containerEl).setName("Display").setHeading();

	new Setting(containerEl)
		.setName("Chat view location")
		.setDesc("Where to open new chat views")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("right-tab", "Right pane (tabs)")
				.addOption("right-split", "Right pane (split)")
				.addOption("editor-tab", "Editor area (tabs)")
				.addOption("editor-split", "Editor area (split)")
				.setValue(plugin.settings.chatViewLocation)
				.onChange(async (value) => {
					plugin.settings.chatViewLocation = value as ChatViewLocation;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Chat font size")
		.setDesc(
			`Adjust the font size of the chat message area (${CHAT_FONT_SIZE_MIN}-${CHAT_FONT_SIZE_MAX}px).`,
		)
		.addText((text) => {
			const getCurrentDisplayValue = (): string => {
				const currentFontSize = plugin.settings.displaySettings.fontSize;
				return currentFontSize === null ? "" : String(currentFontSize);
			};

			const persistChatFontSize = async (fontSize: number | null): Promise<void> => {
				if (plugin.settings.displaySettings.fontSize === fontSize) {
					return;
				}
				const nextSettings = {
					...plugin.settings,
					displaySettings: {
						...plugin.settings.displaySettings,
						fontSize,
					},
				};
				await plugin.saveSettingsAndNotify(nextSettings);
			};

			text
				.setPlaceholder(`${CHAT_FONT_SIZE_MIN}-${CHAT_FONT_SIZE_MAX}`)
				.setValue(getCurrentDisplayValue())
				.onChange(async (value) => {
					if (value.trim().length === 0) {
						await persistChatFontSize(null);
						return;
					}
					const trimmedValue = value.trim();
					if (!/^-?\d+$/.test(trimmedValue)) {
						return;
					}
					const numericValue = Number.parseInt(trimmedValue, 10);
					if (
						numericValue < CHAT_FONT_SIZE_MIN ||
						numericValue > CHAT_FONT_SIZE_MAX
					) {
						return;
					}
					const parsedFontSize = parseChatFontSize(numericValue);
					if (parsedFontSize === null) {
						return;
					}
					if (plugin.settings.displaySettings.fontSize !== parsedFontSize) {
						await persistChatFontSize(parsedFontSize);
					}
				});

			text.inputEl.addEventListener("blur", () => {
				const currentInputValue = text.getValue();
				const parsedFontSize = parseChatFontSize(currentInputValue);
				if (currentInputValue.trim().length > 0 && parsedFontSize === null) {
					text.setValue(getCurrentDisplayValue());
					return;
				}
				if (parsedFontSize !== null) {
					text.setValue(String(parsedFontSize));
					if (plugin.settings.displaySettings.fontSize !== parsedFontSize) {
						void persistChatFontSize(parsedFontSize);
					}
					return;
				}
				text.setValue("");
			});
		});

	new Setting(containerEl)
		.setName("Show emojis")
		.setDesc(
			"Display emoji icons in tool calls, thoughts, plans, and terminal blocks.",
		)
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.displaySettings.showEmojis)
				.onChange(async (value) => {
					plugin.settings.displaySettings.showEmojis = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Auto-collapse long diffs")
		.setDesc("Automatically collapse diffs that exceed the line threshold.")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.displaySettings.autoCollapseDiffs)
				.onChange(async (value) => {
					plugin.settings.displaySettings.autoCollapseDiffs = value;
					await plugin.saveSettings();
					redisplay();
				}),
		);

	if (plugin.settings.displaySettings.autoCollapseDiffs) {
		new Setting(containerEl)
			.setName("Collapse threshold")
			.setDesc("Diffs with more lines than this will be collapsed by default.")
			.addText((text) =>
				text
					.setPlaceholder("10")
					.setValue(
						String(plugin.settings.displaySettings.diffCollapseThreshold),
					)
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							plugin.settings.displaySettings.diffCollapseThreshold = num;
							await plugin.saveSettings();
						}
					}),
			);
	}
}

function renderFloatingSection(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	new Setting(containerEl).setName("Floating chat").setHeading();

	new Setting(containerEl)
		.setName("Show floating button")
		.setDesc("Display a floating chat button that opens a draggable chat window.")
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.showFloatingButton).onChange(async (value) => {
				const wasEnabled = plugin.settings.showFloatingButton;
				plugin.settings.showFloatingButton = value;
				await plugin.saveSettings();
				if (value && !wasEnabled) {
					plugin.openNewFloatingChat();
				} else if (!value && wasEnabled) {
					const instances = plugin.getFloatingChatInstances();
					for (const instanceId of instances) {
						plugin.closeFloatingChat(instanceId);
					}
				}
			}),
		);

	new Setting(containerEl)
		.setName("Floating button image")
		.setDesc(
			"URL or path to an image for the floating button. Leave empty for default icon.",
		)
		.addText((text) =>
			text
				.setPlaceholder("https://example.com/avatar.png")
				.setValue(plugin.settings.floatingButtonImage)
				.onChange(async (value) => {
					plugin.settings.floatingButtonImage = value.trim();
					await plugin.saveSettings();
				}),
		);
}

function renderPermissionSection(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	new Setting(containerEl).setName("Permissions").setHeading();
	new Setting(containerEl)
		.setName("Auto-allow permissions")
		.setDesc(
			"Automatically allow all permission requests from agents. ⚠️ Use with caution - this gives agents full access to your system.",
		)
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.autoAllowPermissions)
				.onChange(async (value) => {
					plugin.settings.autoAllowPermissions = value;
					await plugin.saveSettings();
				}),
		);
}

function renderWindowsSection(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	redisplay: () => void,
): void {
	if (!Platform.isWin) {
		return;
	}

	new Setting(containerEl).setName("Windows Subsystem for Linux").setHeading();

	new Setting(containerEl)
		.setName("Enable WSL mode")
		.setDesc(
			"Run agents inside Windows Subsystem for Linux. Recommended for agents like Codex that don't work well in native Windows environments.",
		)
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.windowsWslMode)
				.onChange(async (value) => {
					plugin.settings.windowsWslMode = value;
					await plugin.saveSettings();
					redisplay();
				}),
		);

	if (plugin.settings.windowsWslMode) {
		new Setting(containerEl)
			.setName("WSL distribution")
			.setDesc(
				"Specify WSL distribution name (leave empty for default). Example: Ubuntu, Debian",
			)
			.addText((text) =>
				text
					.setPlaceholder("Leave empty for default")
					.setValue(plugin.settings.windowsWslDistribution || "")
					.onChange(async (value) => {
						plugin.settings.windowsWslDistribution = value.trim() || undefined;
						await plugin.saveSettings();
					}),
			);
	}
}

function renderExportSection(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
	redisplay: () => void,
): void {
	new Setting(containerEl).setName("Export").setHeading();

	new Setting(containerEl)
		.setName("Export folder")
		.setDesc("Folder where chat exports will be saved")
		.addText((text) =>
			text
				.setPlaceholder("Obsius")
				.setValue(plugin.settings.exportSettings.defaultFolder)
				.onChange(async (value) => {
					plugin.settings.exportSettings.defaultFolder = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Filename")
		.setDesc(
			"Template for exported filenames. Use {date} for date and {time} for time",
		)
		.addText((text) =>
			text
				.setPlaceholder("obsius_{date}_{time}")
				.setValue(plugin.settings.exportSettings.filenameTemplate)
				.onChange(async (value) => {
					plugin.settings.exportSettings.filenameTemplate = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Frontmatter tag")
		.setDesc(
			"Tag to add to exported notes. Supports nested tags (e.g., projects/obsius). Leave empty to disable.",
		)
		.addText((text) =>
			text
				.setPlaceholder("obsius")
				.setValue(plugin.settings.exportSettings.frontmatterTag)
				.onChange(async (value) => {
					plugin.settings.exportSettings.frontmatterTag = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Include images")
		.setDesc("Include images in exported markdown files")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.exportSettings.includeImages)
				.onChange(async (value) => {
					plugin.settings.exportSettings.includeImages = value;
					await plugin.saveSettings();
					redisplay();
				}),
		);

	if (plugin.settings.exportSettings.includeImages) {
		new Setting(containerEl)
			.setName("Image location")
			.setDesc("Where to save exported images")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("obsidian", "Use Obsidian's attachment setting")
					.addOption("custom", "Save to custom folder")
					.addOption("base64", "Embed as Base64 (not recommended)")
					.setValue(plugin.settings.exportSettings.imageLocation)
					.onChange(async (value) => {
						plugin.settings.exportSettings.imageLocation = value as
							| "obsidian"
							| "custom"
							| "base64";
						await plugin.saveSettings();
						redisplay();
					}),
			);

		if (plugin.settings.exportSettings.imageLocation === "custom") {
			new Setting(containerEl)
				.setName("Custom image folder")
				.setDesc("Folder path for exported images (relative to vault root)")
				.addText((text) =>
					text
						.setPlaceholder("Obsius")
						.setValue(plugin.settings.exportSettings.imageCustomFolder)
						.onChange(async (value) => {
							plugin.settings.exportSettings.imageCustomFolder = value;
							await plugin.saveSettings();
						}),
				);
		}
	}

	new Setting(containerEl)
		.setName("Auto-export on new chat")
		.setDesc("Automatically export the current chat when starting a new chat")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.exportSettings.autoExportOnNewChat)
				.onChange(async (value) => {
					plugin.settings.exportSettings.autoExportOnNewChat = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Auto-export on close chat")
		.setDesc("Automatically export the current chat when closing the chat view")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.exportSettings.autoExportOnCloseChat)
				.onChange(async (value) => {
					plugin.settings.exportSettings.autoExportOnCloseChat = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Open note after export")
		.setDesc("Automatically open the exported note after exporting")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.exportSettings.openFileAfterExport)
				.onChange(async (value) => {
					plugin.settings.exportSettings.openFileAfterExport = value;
					await plugin.saveSettings();
				}),
		);
}

function renderDeveloperSection(
	containerEl: HTMLElement,
	plugin: AgentClientPlugin,
): void {
	new Setting(containerEl).setName("Developer").setHeading();
	new Setting(containerEl)
		.setName("Debug mode")
		.setDesc(
			"Enable debug logging to console. Useful for development and troubleshooting.",
		)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.debugMode).onChange(async (value) => {
				plugin.settings.debugMode = value;
				await plugin.saveSettings();
			}),
		);
}
