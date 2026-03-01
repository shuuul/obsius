import type { SlashCommand } from "../domain/models/chat-session";
import type { PickerCategory } from "../components/picker/types";

export interface ClassifiedCommands {
	commands: SlashCommand[];
	mcp: SlashCommand[];
	skills: SlashCommand[];
}

const MCP_PATTERNS = [
	/^mcp[_-]/i,
	/^[a-z]+_[a-z]+$/,
	/_search$/i,
	/_list$/i,
	/_get$/i,
	/_create$/i,
	/_read$/i,
	/_write$/i,
];

const SKILL_PATTERNS = [/^skill[_-]/i, /^agent[_-]/i];

export function classifyCommand(cmd: SlashCommand): PickerCategory {
	const name = cmd.name;
	const desc = (cmd.description || "").toLowerCase();

	if (desc.includes("mcp") || desc.includes("model context protocol")) {
		return "mcp";
	}

	if (desc.includes("skill")) {
		return "skill";
	}

	for (const pattern of MCP_PATTERNS) {
		if (pattern.test(name)) return "mcp";
	}

	for (const pattern of SKILL_PATTERNS) {
		if (pattern.test(name)) return "skill";
	}

	if (name.includes("/") || name.includes(":")) {
		return "mcp";
	}

	return "command";
}

export function classifyCommands(commands: SlashCommand[]): ClassifiedCommands {
	const result: ClassifiedCommands = {
		commands: [],
		mcp: [],
		skills: [],
	};

	for (const cmd of commands) {
		const category = classifyCommand(cmd);
		if (category === "mcp") {
			result.mcp.push(cmd);
		} else if (category === "skill") {
			result.skills.push(cmd);
		} else {
			result.commands.push(cmd);
		}
	}

	return result;
}
