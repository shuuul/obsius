const SLASH_TOKEN_PREFIX = "@[obsius-slash:";
const SLASH_TOKEN_REGEX = /@\[obsius-slash:([^\]]+)\]/g;

export function createSlashCommandToken(commandName: string): string {
	return `${SLASH_TOKEN_PREFIX}${commandName}]`;
}

export function parseSlashCommandToken(token: string): string | null {
	const match = token.match(/^@\[obsius-slash:([^\]]+)\]$/);
	return match ? match[1] : null;
}

export function extractSlashCommandTokens(message: string): {
	messageWithSlashAsText: string;
	commands: string[];
} {
	const commands: string[] = [];
	SLASH_TOKEN_REGEX.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = SLASH_TOKEN_REGEX.exec(message)) !== null) {
		commands.push(match[1]);
	}

	SLASH_TOKEN_REGEX.lastIndex = 0;
	const messageWithSlashAsText = message.replace(
		SLASH_TOKEN_REGEX,
		(_full, name: string) => `/${name} `,
	);

	return { messageWithSlashAsText, commands };
}

export function getSlashTokenRegex(): RegExp {
	return /@\[obsius-slash:([^\]]+)\]/g;
}
