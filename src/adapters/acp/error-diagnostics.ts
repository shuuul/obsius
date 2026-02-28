import { Platform } from "obsidian";

export function getSpawnErrorInfo(
	error: Error,
	command: string,
	agentLabel: string,
): { title: string; message: string; suggestion: string } {
	if ((error as NodeJS.ErrnoException).code === "ENOENT") {
		return {
			title: "Command not found",
			message: `The command "${command}" could not be found. Please check the path configuration for ${agentLabel}.`,
			suggestion: getCommandNotFoundSuggestion(command),
		};
	}

	return {
		title: "Agent startup error",
		message: `Failed to start ${agentLabel}: ${error.message}`,
		suggestion: "Please check the agent configuration in settings.",
	};
}

export function getCommandNotFoundSuggestion(command: string): string {
	const commandName = command.split("/").pop()?.split("\\").pop() || "command";

	if (Platform.isWin) {
		return `1. Verify the agent path: Use "where ${commandName}" in Command Prompt to find the correct path. 2. If the agent requires Node.js, also check that Node.js path is correctly set in General settings (use "where node" to find it).`;
	}

	return `1. Verify the agent path: Use "which ${commandName}" in Terminal to find the correct path. 2. If the agent requires Node.js, also check that Node.js path is correctly set in General settings (use "which node" to find it).`;
}

export function extractStderrErrorHint(stderr: string): string | null {
	if (!stderr) {
		return null;
	}

	if (
		stderr.includes("API key is missing") ||
		stderr.includes("LoadAPIKeyError")
	) {
		return "The agent API key may be missing. For custom agents, add the required API key (for example, ANTHROPIC_API_KEY) in the agent environment variables settings.";
	}

	if (
		stderr.includes("authentication") ||
		stderr.includes("unauthorized") ||
		stderr.includes("401")
	) {
		return "The agent reported an authentication error. Check that your API key or credentials are valid.";
	}

	return null;
}
