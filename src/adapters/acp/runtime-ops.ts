import * as acp from "@agentclientprotocol/sdk";
import { Platform } from "obsidian";

import type {
	NewSessionResult,
} from "../../domain/ports/agent-client.port";
import type { PromptContent } from "../../domain/models/prompt-content";
import type {
	SessionModeState,
	SessionModelState,
} from "../../domain/models/chat-session";
import type { Logger } from "../../shared/logger";
import { AcpTypeConverter } from "./acp-type-converter";
import { convertWindowsPathToWsl } from "../../shared/wsl-utils";

function assertConnection(
	connection: acp.ClientSideConnection | null,
	message = "Connection not initialized. Call initialize() first.",
): acp.ClientSideConnection {
	if (!connection) {
		throw new Error(message);
	}
	return connection;
}

function toSessionResult(sessionResult: acp.NewSessionResponse): NewSessionResult {
	let modes: SessionModeState | undefined;
	if (sessionResult.modes) {
		modes = {
			availableModes: sessionResult.modes.availableModes.map((mode) => ({
				id: mode.id,
				name: mode.name,
				description: mode.description ?? undefined,
			})),
			currentModeId: sessionResult.modes.currentModeId,
		};
	}

	let models: SessionModelState | undefined;
	if (sessionResult.models) {
		models = {
			availableModels: sessionResult.models.availableModels.map((model) => ({
				modelId: model.modelId,
				name: model.name,
				description: model.description ?? undefined,
			})),
			currentModelId: sessionResult.models.currentModelId,
		};
	}

	return {
		sessionId: sessionResult.sessionId,
		modes,
		models,
	};
}

export async function newSessionOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	workingDirectory: string;
	windowsWslMode: boolean;
}): Promise<NewSessionResult> {
	const connection = assertConnection(args.connection);
	const { logger, workingDirectory, windowsWslMode } = args;

	try {
		logger.log("[AcpAdapter] Creating new session...");
		let sessionCwd = workingDirectory;
		if (Platform.isWin && windowsWslMode) {
			sessionCwd = convertWindowsPathToWsl(workingDirectory);
		}

		logger.log("[AcpAdapter] Using working directory:", sessionCwd);
		const sessionResult = await connection.newSession({
			cwd: sessionCwd,
			mcpServers: [],
		});

		logger.log(`[AcpAdapter] 📝 Created session: ${sessionResult.sessionId}`);
		logger.log(
			"[AcpAdapter] NewSessionResponse:",
			JSON.stringify(sessionResult, null, 2),
		);

		const result = toSessionResult(sessionResult);
		if (result.modes) {
			logger.log(
				`[AcpAdapter] Session modes: ${result.modes.availableModes.map((mode) => mode.id).join(", ")} (current: ${result.modes.currentModeId})`,
			);
		}
		if (result.models) {
			logger.log(
				`[AcpAdapter] Session models: ${result.models.availableModels.map((model) => model.modelId).join(", ")} (current: ${result.models.currentModelId})`,
			);
		}
		return result;
	} catch (error) {
		logger.error("[AcpAdapter] New Session Error:", error);
		throw error;
	}
}

export async function authenticateOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	methodId: string;
}): Promise<boolean> {
	const connection = assertConnection(args.connection);
	const { logger, methodId } = args;

	try {
		await connection.authenticate({ methodId });
		logger.log("[AcpAdapter] ✅ authenticate ok:", methodId);
		return true;
	} catch (error: unknown) {
		logger.error("[AcpAdapter] Authentication Error:", error);
		return false;
	}
}

function isIgnoredPromptError(error: unknown): boolean {
	const errorObj = error as Record<string, unknown> | null;
	if (
		!errorObj ||
		typeof errorObj !== "object" ||
		!("code" in errorObj) ||
		errorObj.code !== -32603 ||
		!("data" in errorObj)
	) {
		return false;
	}

	const errorData = errorObj.data as Record<string, unknown> | null;
	if (
		!errorData ||
		typeof errorData !== "object" ||
		!("details" in errorData) ||
		typeof errorData.details !== "string"
	) {
		return false;
	}

	return (
		errorData.details.includes("empty response text") ||
		errorData.details.includes("user aborted")
	);
}

export async function sendPromptOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	sessionId: string;
	content: PromptContent[];
	resetCurrentMessage: () => void;
	setPromptSessionUpdateCount: (value: number) => void;
	getPromptSessionUpdateCount: () => number;
	setRecentStderr: (value: string) => void;
	extractStderrErrorHint: () => string | null;
}): Promise<void> {
	const connection = assertConnection(args.connection);
	const {
		logger,
		sessionId,
		content,
		resetCurrentMessage,
		setPromptSessionUpdateCount,
		getPromptSessionUpdateCount,
		setRecentStderr,
		extractStderrErrorHint,
	} = args;

	resetCurrentMessage();
	setPromptSessionUpdateCount(0);
	setRecentStderr("");

	try {
		const acpContent = content.map((item) =>
			AcpTypeConverter.toAcpContentBlock(item),
		);
		logger.log(
			`[AcpAdapter] Sending prompt with ${content.length} content blocks`,
		);
		const promptResult = await connection.prompt({
			sessionId,
			prompt: acpContent,
		});

		logger.log(`[AcpAdapter] Agent completed with: ${promptResult.stopReason}`);
		if (
			getPromptSessionUpdateCount() === 0 &&
			promptResult.stopReason === "end_turn"
		) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			const stderrHint = extractStderrErrorHint();
			if (stderrHint) {
				logger.warn(
					"[AcpAdapter] Agent returned end_turn with no session updates — detected error in stderr",
				);
				throw new Error(
					`The agent returned an empty response. ${stderrHint}`,
				);
			}
			logger.log(
				"[AcpAdapter] Agent returned end_turn with no session updates (may be expected for some commands)",
			);
		}
	} catch (error: unknown) {
		logger.error("[AcpAdapter] Prompt Error:", error);
		if (isIgnoredPromptError(error)) {
			if (
				typeof error === "object" &&
				error !== null &&
				"data" in error &&
				typeof (error as { data?: { details?: string } }).data?.details ===
					"string" &&
				(error as { data: { details: string } }).data.details.includes(
					"user aborted",
				)
			) {
				logger.log("[AcpAdapter] User aborted request - ignoring");
			} else {
				logger.log("[AcpAdapter] Empty response text error - ignoring");
			}
			return;
		}
		throw error;
	}
}

export async function cancelOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	sessionId: string;
	cancelAllOperations: () => void;
}): Promise<void> {
	const { connection, logger, sessionId, cancelAllOperations } = args;
	if (!connection) {
		logger.warn("[AcpAdapter] Cannot cancel: no connection");
		return;
	}

	try {
		logger.log("[AcpAdapter] Sending session/cancel notification...");
		await connection.cancel({ sessionId });
		logger.log("[AcpAdapter] Cancellation request sent successfully");
		cancelAllOperations();
	} catch (error) {
		logger.error("[AcpAdapter] Failed to send cancellation:", error);
		cancelAllOperations();
	}
}

export function disconnectOperation(args: {
	logger: Logger;
	agentProcessPid: number | undefined;
	killAgentProcess: () => void;
	cancelAllOperations: () => void;
}): void {
	const { logger, agentProcessPid, killAgentProcess, cancelAllOperations } = args;
	logger.log("[AcpAdapter] Disconnecting...");
	cancelAllOperations();
	if (agentProcessPid) {
		logger.log(`[AcpAdapter] Killing agent process (PID: ${agentProcessPid})`);
		killAgentProcess();
	}
	logger.log("[AcpAdapter] Disconnected");
}

export async function setSessionModeOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	sessionId: string;
	modeId: string;
}): Promise<void> {
	const connection = assertConnection(args.connection);
	const { logger, sessionId, modeId } = args;

	logger.log(
		`[AcpAdapter] Setting session mode to: ${modeId} for session: ${sessionId}`,
	);
	try {
		await connection.setSessionMode({ sessionId, modeId });
		logger.log(`[AcpAdapter] Session mode set to: ${modeId}`);
	} catch (error) {
		logger.error("[AcpAdapter] Failed to set session mode:", error);
		throw error;
	}
}

export async function setSessionModelOperation(args: {
	connection: acp.ClientSideConnection | null;
	logger: Logger;
	sessionId: string;
	modelId: string;
}): Promise<void> {
	const connection = assertConnection(args.connection);
	const { logger, sessionId, modelId } = args;

	logger.log(
		`[AcpAdapter] Setting session model to: ${modelId} for session: ${sessionId}`,
	);
	try {
		await connection.unstable_setSessionModel({ sessionId, modelId });
		logger.log(`[AcpAdapter] Session model set to: ${modelId}`);
	} catch (error) {
		logger.error("[AcpAdapter] Failed to set session model:", error);
		throw error;
	}
}
