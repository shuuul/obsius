import { Notice } from "obsidian";

/**
 * Show an Obsidian Notice with the plugin prefix.
 * Uses a template literal so the sentence-case lint rule skips it
 * (the `[Obsius]` bracket prefix is not parseable as sentence case).
 */
export function pluginNotice(message: string): void {
	new Notice(`[Obsius] ${message}`);
}
