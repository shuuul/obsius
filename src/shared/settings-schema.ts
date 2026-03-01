import { z } from "zod";
import type {
	AgentClientPluginSettings,
	ChatViewLocation,
	SendMessageShortcut,
} from "../plugin";

export const SETTINGS_SCHEMA_VERSION = 4;

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
	opencode: commonAgentSettingsSchema,
	customAgents: z.array(commonAgentSettingsSchema),
	defaultAgentId: z.string().min(1),
	autoAllowPermissions: z.boolean(),
	autoMentionActiveNote: z.boolean(),
	debugMode: z.boolean(),
	nodePath: z.string(),
	windowsWslMode: z.boolean(),
	windowsWslDistribution: z.string().optional(),
	sendMessageShortcut: sendMessageShortcutSchema,
	chatViewLocation: chatViewLocationSchema,
	displaySettings: displaySettingsSchema,
	savedSessions: z.array(savedSessionSchema),
	lastUsedModels: z.record(z.string(), z.string()),
	candidateModels: z.record(z.string(), z.array(z.string())).optional(),
	cachedAgentModels: z
		.record(
			z.string(),
			z.array(
				z.object({
					modelId: z.string(),
					name: z.string(),
					description: z.string().optional(),
				}),
			),
		)
		.optional(),
	cachedAgentModes: z
		.record(
			z.string(),
			z.array(
				z.object({
					id: z.string(),
					name: z.string(),
					description: z.string().optional(),
				}),
			),
		)
		.optional(),
	modeModelDefaults: z
		.record(z.string(), z.record(z.string(), z.string()))
		.optional(),
	lastModeModels: z
		.record(z.string(), z.record(z.string(), z.string()))
		.optional(),
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
	opencode: {
		id: "opencode",
		displayName: "OpenCode",
		command: "",
		args: ["acp"],
		env: [],
	},
	customAgents: [],
	defaultAgentId: "claude-code-acp",
	autoAllowPermissions: false,
	autoMentionActiveNote: true,
	debugMode: false,
	nodePath: "",
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
	candidateModels: {},
	cachedAgentModels: {},
	cachedAgentModes: {},
	modeModelDefaults: {},
	lastModeModels: {},
});

function migrateV2ToV3(candidate: Record<string, unknown>): void {
	if (candidate.schemaVersion !== 2) return;
	const defaults = createDefaultSettings();
	if (!candidate.opencode) {
		candidate.opencode = { ...defaults.opencode };
	}
	candidate.schemaVersion = 3;
}

function migrateV3ToV4(candidate: Record<string, unknown>): void {
	if (candidate.schemaVersion !== 3) return;
	delete candidate.exportSettings;
	delete candidate.showFloatingButton;
	delete candidate.floatingButtonImage;
	delete candidate.floatingWindowSize;
	delete candidate.floatingWindowPosition;
	delete candidate.floatingButtonPosition;
	candidate.schemaVersion = SETTINGS_SCHEMA_VERSION;
}

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

	// Run migrations before version check
	migrateV2ToV3(candidate);
	migrateV3ToV4(candidate);

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
