import { z } from "zod";
import type {
	AgentClientPluginSettings,
	ChatViewLocation,
	SendMessageShortcut,
} from "../plugin";

export const SETTINGS_SCHEMA_VERSION = 2;

const sendMessageShortcutSchema = z.union([
	z.literal("enter"),
	z.literal("cmd-enter"),
]) satisfies z.ZodType<SendMessageShortcut>;

const chatViewLocationSchema = z.union([
	z.literal("right-tab"),
	z.literal("right-split"),
	z.literal("editor-tab"),
	z.literal("editor-split"),
]) satisfies z.ZodType<ChatViewLocation>;

const envVarSchema = z.object({
	key: z.string().min(1),
	value: z.string(),
});

const commonAgentSettingsSchema = z.object({
	id: z.string().min(1),
	displayName: z.string().min(1),
	command: z.string(),
	args: z.array(z.string()),
	env: z.array(envVarSchema),
});

const apiKeyAgentSettingsSchema = commonAgentSettingsSchema.extend({
	apiKey: z.string(),
});

const exportSettingsSchema = z.object({
	defaultFolder: z.string(),
	filenameTemplate: z.string(),
	autoExportOnNewChat: z.boolean(),
	autoExportOnCloseChat: z.boolean(),
	openFileAfterExport: z.boolean(),
	includeImages: z.boolean(),
	imageLocation: z.union([
		z.literal("obsidian"),
		z.literal("custom"),
		z.literal("base64"),
	]),
	imageCustomFolder: z.string(),
	frontmatterTag: z.string(),
});

const displaySettingsSchema = z.object({
	autoCollapseDiffs: z.boolean(),
	diffCollapseThreshold: z.number().int().positive(),
	maxNoteLength: z.number().int().min(1),
	maxSelectionLength: z.number().int().min(1),
	showEmojis: z.boolean(),
	fontSize: z.number().int().min(10).max(30).nullable(),
});

const savedSessionSchema = z.object({
	sessionId: z.string().min(1),
	agentId: z.string().min(1),
	cwd: z.string().min(1),
	title: z.string().optional(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

const settingsSchema = z.object({
	schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION),
	claude: apiKeyAgentSettingsSchema,
	codex: apiKeyAgentSettingsSchema,
	gemini: apiKeyAgentSettingsSchema,
	customAgents: z.array(commonAgentSettingsSchema),
	defaultAgentId: z.string().min(1),
	autoAllowPermissions: z.boolean(),
	autoMentionActiveNote: z.boolean(),
	debugMode: z.boolean(),
	nodePath: z.string(),
	exportSettings: exportSettingsSchema,
	windowsWslMode: z.boolean(),
	windowsWslDistribution: z.string().optional(),
	sendMessageShortcut: sendMessageShortcutSchema,
	chatViewLocation: chatViewLocationSchema,
	displaySettings: displaySettingsSchema,
	savedSessions: z.array(savedSessionSchema),
	lastUsedModels: z.record(z.string(), z.string()),
	showFloatingButton: z.boolean(),
	floatingButtonImage: z.string(),
	floatingWindowSize: z.object({
		width: z.number().int().positive(),
		height: z.number().int().positive(),
	}),
	floatingWindowPosition: z
		.object({
			x: z.number(),
			y: z.number(),
		})
		.nullable(),
	floatingButtonPosition: z
		.object({
			x: z.number(),
			y: z.number(),
		})
		.nullable(),
}) satisfies z.ZodType<AgentClientPluginSettings>;

export const createDefaultSettings = (): AgentClientPluginSettings => ({
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	claude: {
		id: "claude-code-acp",
		displayName: "Claude Code",
		apiKey: "",
		command: "",
		args: [],
		env: [],
	},
	codex: {
		id: "codex-acp",
		displayName: "Codex",
		apiKey: "",
		command: "",
		args: [],
		env: [],
	},
	gemini: {
		id: "gemini-cli",
		displayName: "Gemini CLI",
		apiKey: "",
		command: "",
		args: ["--experimental-acp"],
		env: [],
	},
	customAgents: [],
	defaultAgentId: "claude-code-acp",
	autoAllowPermissions: false,
	autoMentionActiveNote: true,
	debugMode: false,
	nodePath: "",
	exportSettings: {
		defaultFolder: "Obsius",
		filenameTemplate: "obsius_{date}_{time}",
		autoExportOnNewChat: false,
		autoExportOnCloseChat: false,
		openFileAfterExport: true,
		includeImages: true,
		imageLocation: "obsidian",
		imageCustomFolder: "Obsius",
		frontmatterTag: "obsius",
	},
	windowsWslMode: false,
	windowsWslDistribution: undefined,
	sendMessageShortcut: "enter",
	chatViewLocation: "right-tab",
	displaySettings: {
		autoCollapseDiffs: false,
		diffCollapseThreshold: 10,
		maxNoteLength: 10000,
		maxSelectionLength: 10000,
		showEmojis: true,
		fontSize: null,
	},
	savedSessions: [],
	lastUsedModels: {},
	showFloatingButton: false,
	floatingButtonImage: "",
	floatingWindowSize: { width: 400, height: 500 },
	floatingWindowPosition: null,
	floatingButtonPosition: null,
});

export function parseStoredSettings(raw: unknown): {
	settings: AgentClientPluginSettings;
	resetReason?: string;
} {
	if (!raw || typeof raw !== "object") {
		return {
			settings: createDefaultSettings(),
			resetReason: "missing or non-object settings payload",
		};
	}

	const candidate = raw as Record<string, unknown>;
	if (candidate.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
		return {
			settings: createDefaultSettings(),
			resetReason: `schema version mismatch (expected ${SETTINGS_SCHEMA_VERSION})`,
		};
	}

	const parsed = settingsSchema.safeParse(candidate);
	if (!parsed.success) {
		return {
			settings: createDefaultSettings(),
			resetReason: `invalid settings payload: ${parsed.error.issues
				.map((issue) => issue.path.join(".") || "root")
				.join(", ")}`,
		};
	}

	return { settings: parsed.data };
}
