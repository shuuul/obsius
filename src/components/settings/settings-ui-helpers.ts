import { setIcon } from "obsidian";

/**
 * Render a large, icon-decorated section header with a divider line.
 * Used to visually separate major settings sections.
 */
export function renderSectionHeader(
	containerEl: HTMLElement,
	icon: string,
	title: string,
	description?: string,
): HTMLElement {
	const wrapper = containerEl.createDiv({
		cls: "obsius-settings-section-header",
	});

	const iconEl = wrapper.createDiv({
		cls: "obsius-settings-section-header-icon",
	});
	setIcon(iconEl, icon);

	const textEl = wrapper.createDiv({
		cls: "obsius-settings-section-header-text",
	});
	textEl.createEl("h3", {
		text: title,
		cls: "obsius-settings-section-header-title",
	});

	if (description) {
		textEl.createEl("p", {
			text: description,
			cls: "obsius-settings-section-header-desc",
		});
	}

	return wrapper;
}

/**
 * Render a smaller sub-heading for agent entries within a section.
 */
export function renderAgentSubHeading(
	containerEl: HTMLElement,
	title: string,
): HTMLElement {
	const wrapper = containerEl.createDiv({
		cls: "obsius-settings-agent-subheading",
	});
	wrapper.createEl("h4", {
		text: title,
		cls: "obsius-settings-agent-subheading-title",
	});
	return wrapper;
}
