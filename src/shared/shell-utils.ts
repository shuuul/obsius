import { execFile } from "child_process";
import { Platform } from "obsidian";

/**
 * Shell escaping utilities for different platforms.
 */

/**
 * Default command names for built-in agents, keyed by agent ID.
 * Used as fallback when the user leaves the command field empty —
 * the login shell wrapper resolves these from PATH.
 */
export const BUILTIN_AGENT_DEFAULT_COMMANDS: Record<string, string> = {
	"claude-code-acp": "claude-agent-acp",
	"codex-acp": "codex-acp",
	"gemini-cli": "gemini",
	opencode: "opencode",
};

/**
 * Escape a shell argument for Windows cmd.exe.
 * Only wraps in double quotes if the argument contains spaces or special characters.
 *
 * In cmd.exe:
 * - Double quotes are escaped by doubling them: " → ""
 * - Percent signs are escaped by doubling them: % → %% (to prevent environment variable expansion)
 */
export function escapeShellArgWindows(arg: string): string {
	// Escape percent signs and double quotes
	const escaped = arg.replace(/%/g, "%%").replace(/"/g, '""');

	// Only wrap in quotes if contains spaces or special characters that need quoting
	if (/[\s&()<>|^]/.test(arg)) {
		return `"${escaped}"`;
	}
	return escaped;
}

/**
 * Resolve the login shell for the current platform.
 * Uses $SHELL environment variable when available (covers NixOS, etc.),
 * falls back to platform defaults (/bin/zsh on macOS, /bin/sh on Linux).
 */
export function getLoginShell(): string {
	if (process.env.SHELL) {
		return process.env.SHELL;
	}
	return Platform.isMacOS ? "/bin/zsh" : "/bin/sh";
}

/**
 * Resolve a command name to its absolute path via the user's shell PATH.
 * Spawns a login shell to pick up the full PATH from shell profiles.
 * Returns null if the command is not found or resolution times out.
 */
export function resolveCommandFromShell(
	commandName: string,
): Promise<string | null> {
	return new Promise((resolve) => {
		if (!commandName || commandName.trim().length === 0) {
			resolve(null);
			return;
		}

		const name = commandName.trim();

		if (Platform.isWin) {
			execFile("where", [name], { timeout: 5000 }, (error, stdout) => {
				if (error || !stdout.trim()) {
					resolve(null);
					return;
				}
				resolve(stdout.trim().split(/\r?\n/)[0]);
			});
		} else {
			const shell = getLoginShell();
			execFile(
				shell,
				["-l", "-c", `which '${name.replace(/'/g, "'\\''")}'`],
				{ timeout: 5000 },
				(error, stdout) => {
					if (error || !stdout.trim()) {
						resolve(null);
						return;
					}
					resolve(stdout.trim().split("\n")[0]);
				},
			);
		}
	});
}
