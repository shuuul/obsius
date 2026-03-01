import { FileSystemAdapter, type App } from "obsidian";

export function resolveVaultBasePath(app: App): string {
	const adapter = app.vault.adapter;
	if (adapter instanceof FileSystemAdapter) {
		return adapter.getBasePath();
	}
	return process.cwd();
}
