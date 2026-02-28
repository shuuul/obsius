import * as acp from "@agentclientprotocol/sdk";
import { Platform } from "obsidian";

import type {
	ForkSessionResult,
	ListSessionsResult,
	LoadSessionResult,
	ResumeSessionResult,
} from "../../domain/models/session-info";
import type {
	SessionModeState,
	SessionModelState,
} from "../../domain/models/chat-session";
import type { Logger } from "../../shared/logger";
import { convertWindowsPathToWsl } from "../../shared/wsl-utils";

type ModeLike = { id: string; name: string; description?: string | null };
type ModelLike = {
	modelId: string;
	name: string;
	description?: string | null;
};

function mapSessionModesAndModels(response: {
	modes?:
		| {
				availableModes: ModeLike[];
				currentModeId: string;
		  }
		| null;
	models?:
		| {
				availableModels: ModelLike[];
				currentModelId: string;
		  }
		| null;
}): {
	modes: SessionModeState | undefined;
	models: SessionModelState | undefined;
} {
	let modes: SessionModeState | undefined;
	if (response.modes) {
		modes = {
			availableModes: response.modes.availableModes.map((mode) => ({
				id: mode.id,
				name: mode.name,
				description: mode.description ?? undefined,
			})),
			currentModeId: response.modes.currentModeId,
		};
	}

	let models: SessionModelState | undefined;
	if (response.models) {
		models = {
			availableModels: response.models.availableModels.map((model) => ({
				modelId: model.modelId,
				name: model.name,
				description: model.description ?? undefined,
			})),
			currentModelId: response.models.currentModelId,
		};
	}

	return { modes, models };
}

function toSessionCwd(cwd: string, windowsWslMode: boolean): string {
	if (Platform.isWin && windowsWslMode) {
		return convertWindowsPathToWsl(cwd);
	}
	return cwd;
}

function assertConnection(
	connection: acp.ClientSideConnection | null,
): acp.ClientSideConnection {
	if (!connection) {
		throw new Error("ACP connection not initialized. Call initialize() first.");
	}
	return connection;
}

export async function listSessionsOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	windowsWslMode: boolean;
	cwd?: string;
	cursor?: string;
}): Promise<ListSessionsResult> {
	const connection = assertConnection(args.connection);
	const { logger, windowsWslMode, cwd, cursor } = args;

	try {
		logger.log("[AcpAdapter] Listing sessions...");
		const filterCwd = cwd ? toSessionCwd(cwd, windowsWslMode) : undefined;
		const response = await connection.unstable_listSessions({
			cwd: filterCwd ?? null,
			cursor: cursor ?? null,
		});

		logger.log(`[AcpAdapter] Found ${response.sessions.length} sessions`);
		return {
			sessions: response.sessions.map((session) => ({
				sessionId: session.sessionId,
				cwd: session.cwd,
				title: session.title ?? undefined,
				updatedAt: session.updatedAt ?? undefined,
			})),
			nextCursor: response.nextCursor ?? undefined,
		};
	} catch (error) {
		logger.error("[AcpAdapter] List Sessions Error:", error);
		throw error;
	}
}

export async function loadSessionOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	windowsWslMode: boolean;
	sessionId: string;
	cwd: string;
}): Promise<LoadSessionResult> {
	const connection = assertConnection(args.connection);
	const { logger, windowsWslMode, sessionId, cwd } = args;

	try {
		logger.log(`[AcpAdapter] Loading session: ${sessionId}...`);
		const response = await connection.loadSession({
			sessionId,
			cwd: toSessionCwd(cwd, windowsWslMode),
			mcpServers: [],
		});

		logger.log(`[AcpAdapter] Session loaded: ${sessionId}`);
		const { modes, models } = mapSessionModesAndModels(response);
		return { sessionId, modes, models };
	} catch (error) {
		logger.error("[AcpAdapter] Load Session Error:", error);
		throw error;
	}
}

export async function resumeSessionOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	windowsWslMode: boolean;
	sessionId: string;
	cwd: string;
}): Promise<ResumeSessionResult> {
	const connection = assertConnection(args.connection);
	const { logger, windowsWslMode, sessionId, cwd } = args;

	try {
		logger.log(`[AcpAdapter] Resuming session: ${sessionId}...`);
		const response = await connection.unstable_resumeSession({
			sessionId,
			cwd: toSessionCwd(cwd, windowsWslMode),
			mcpServers: [],
		});

		logger.log(`[AcpAdapter] Session resumed: ${sessionId}`);
		const { modes, models } = mapSessionModesAndModels(response);
		return { sessionId, modes, models };
	} catch (error) {
		logger.error("[AcpAdapter] Resume Session Error:", error);
		throw error;
	}
}

export async function forkSessionOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	windowsWslMode: boolean;
	sessionId: string;
	cwd: string;
}): Promise<ForkSessionResult> {
	const connection = assertConnection(args.connection);
	const { logger, windowsWslMode, sessionId, cwd } = args;

	try {
		logger.log(`[AcpAdapter] Forking session: ${sessionId}...`);
		const response = await connection.unstable_forkSession({
			sessionId,
			cwd: toSessionCwd(cwd, windowsWslMode),
			mcpServers: [],
		});

		logger.log(
			`[AcpAdapter] Session forked: ${sessionId} -> ${response.sessionId}`,
		);
		const { modes, models } = mapSessionModesAndModels(response);
		return { sessionId: response.sessionId, modes, models };
	} catch (error) {
		logger.error("[AcpAdapter] Fork Session Error:", error);
		throw error;
	}
}
