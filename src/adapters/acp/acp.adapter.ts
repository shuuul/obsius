import { ChildProcess } from "child_process";
import * as acp from "@agentclientprotocol/sdk";

import type {
	IAgentClient,
	AgentConfig,
	InitializeResult,
	NewSessionResult,
} from "../../domain/ports/agent-client.port";
import type {
	MessageContent,
	PermissionOption,
} from "../../domain/models/chat-message";
import type { SessionUpdate } from "../../domain/models/session-update";
import type { PromptContent } from "../../domain/models/prompt-content";
import type { ProcessError } from "../../domain/models/agent-error";
import type {
	ListSessionsResult,
	LoadSessionResult,
	ResumeSessionResult,
	ForkSessionResult,
} from "../../domain/models/session-info";
import { TerminalManager } from "../../shared/terminal-manager";
import { getLogger, Logger } from "../../shared/logger";
import type AgentClientPlugin from "../../plugin";
import { routeSessionUpdate } from "./update-routing";
import {
	extractStderrErrorHint,
	getCommandNotFoundSuggestion,
	getSpawnErrorInfo,
} from "./error-diagnostics";
import {
	authenticateOperation,
	cancelOperation,
	disconnectOperation,
	newSessionOperation,
	sendPromptOperation,
	setSessionModeOperation,
	setSessionModelOperation,
} from "./runtime-ops";
import {
	activateNextPermissionOperation,
	cancelPendingPermissionRequestsOperation,
	handlePermissionResponseOperation,
	requestPermissionOperation,
} from "./permission-queue";
import {
	createTerminalOperation,
	killTerminalOperation,
	releaseTerminalOperation,
	terminalOutputOperation,
	waitForTerminalExitOperation,
} from "./terminal-bridge";
import {
	forkSessionOperation,
	listSessionsOperation,
	loadSessionOperation,
	resumeSessionOperation,
} from "./session-ops";
import { initializeOperation } from "./process-lifecycle";

export interface IAcpClient extends acp.Client {
	handlePermissionResponse(requestId: string, optionId: string): void;
	cancelAllOperations(): void;
	resetCurrentMessage(): void;
	terminalOutput(
		params: acp.TerminalOutputRequest,
	): Promise<acp.TerminalOutputResponse>;
}

export class AcpAdapter implements IAgentClient, IAcpClient {
	private connection: acp.ClientSideConnection | null = null;
	private agentProcess: ChildProcess | null = null;
	private logger: Logger;

	private sessionUpdateCallback: ((update: SessionUpdate) => void) | null =
		null;

	private errorCallback: ((error: ProcessError) => void) | null = null;

	private updateMessage: (toolCallId: string, content: MessageContent) => void;

	private currentConfig: AgentConfig | null = null;
	private isInitializedFlag = false;
	private currentAgentId: string | null = null;
	private autoAllowPermissions = false;

	private terminalManager: TerminalManager;
	private currentMessageId: string | null = null;
	private pendingPermissionRequests = new Map<
		string,
		{
			resolve: (response: acp.RequestPermissionResponse) => void;
			toolCallId: string;
			options: PermissionOption[];
		}
	>();
	private pendingPermissionQueue: Array<{
		requestId: string;
		toolCallId: string;
		options: PermissionOption[];
	}> = [];

	private promptSessionUpdateCount = 0;
	private recentStderr = "";

	constructor(private plugin: AgentClientPlugin) {
		this.logger = getLogger();
		this.updateMessage = () => {};

		this.terminalManager = new TerminalManager(plugin);
	}

	setUpdateMessageCallback(
		updateMessage: (toolCallId: string, content: MessageContent) => void,
	): void {
		this.updateMessage = updateMessage;
	}

	async initialize(config: AgentConfig): Promise<InitializeResult> {
		this.logger.log(
			"[AcpAdapter] Starting initialization with config:",
			config,
		);
		this.logger.log(
			`[AcpAdapter] Current state - process: ${!!this.agentProcess}, PID: ${this.agentProcess?.pid}`,
		);

		if (this.agentProcess) {
			this.logger.log(
				`[AcpAdapter] Killing existing process (PID: ${this.agentProcess.pid})`,
			);
			this.agentProcess.kill();
			this.agentProcess = null;
		}

		if (this.connection) {
			this.logger.log("[AcpAdapter] Cleaning up existing connection");
			this.connection = null;
		}

		this.currentConfig = config;

		this.autoAllowPermissions = this.plugin.settings.autoAllowPermissions;

		try {
			const initialized = await initializeOperation({
				config,
				logger: this.logger,
				pluginVersion: this.plugin.manifest.version,
				windowsWslMode: this.plugin.settings.windowsWslMode,
				windowsWslDistribution: this.plugin.settings.windowsWslDistribution,
				nodePath: this.plugin.settings.nodePath,
				onError: (error) => {
					this.errorCallback?.(error);
				},
				clientFactory: (stream) =>
					new acp.ClientSideConnection(() => this, stream),
				onStderrData: (chunk) => {
					this.recentStderr += chunk;
					if (this.recentStderr.length > 8192) {
						this.recentStderr = this.recentStderr.slice(-4096);
					}
				},
				getErrorInfo: (error, command, agentLabel) =>
					this.getErrorInfo(error, command, agentLabel),
				getCommandNotFoundSuggestion: (command) =>
					this.getCommandNotFoundSuggestion(command),
			});
			this.connection = initialized.connection;
			this.agentProcess = initialized.agentProcess;
			this.isInitializedFlag = true;
			this.currentAgentId = config.id;
			return initialized.initializeResult;
		} catch (error) {
			this.logger.error("[AcpAdapter] Initialization Error:", error);

			this.isInitializedFlag = false;
			this.currentAgentId = null;

			throw error;
		}
	}

	async newSession(workingDirectory: string): Promise<NewSessionResult> {
		return await newSessionOperation({
			connection: this.connection,
			logger: this.logger,
			workingDirectory,
			windowsWslMode: this.plugin.settings.windowsWslMode,
		});
	}

	async authenticate(methodId: string): Promise<boolean> {
		return await authenticateOperation({
			connection: this.connection,
			logger: this.logger,
			methodId,
		});
	}

	async sendPrompt(sessionId: string, content: PromptContent[]): Promise<void> {
		await sendPromptOperation({
			connection: this.connection,
			logger: this.logger,
			sessionId,
			content,
			resetCurrentMessage: () => {
				this.resetCurrentMessage();
			},
			setPromptSessionUpdateCount: (value) => {
				this.promptSessionUpdateCount = value;
			},
			getPromptSessionUpdateCount: () => this.promptSessionUpdateCount,
			setRecentStderr: (value) => {
				this.recentStderr = value;
			},
			extractStderrErrorHint: () => this.extractStderrErrorHint(),
		});
	}

	async cancel(sessionId: string): Promise<void> {
		await cancelOperation({
			connection: this.connection,
			logger: this.logger,
			sessionId,
			cancelAllOperations: () => this.cancelAllOperations(),
		});
	}

	disconnect(): Promise<void> {
		disconnectOperation({
			logger: this.logger,
			agentProcessPid: this.agentProcess?.pid,
			killAgentProcess: () => {
				this.agentProcess?.kill();
				this.agentProcess = null;
			},
			cancelAllOperations: () => this.cancelAllOperations(),
		});
		this.connection = null;
		this.currentConfig = null;
		this.isInitializedFlag = false;
		this.currentAgentId = null;
		return Promise.resolve();
	}

	isInitialized(): boolean {
		return (
			this.isInitializedFlag &&
			this.connection !== null &&
			this.agentProcess !== null
		);
	}

	getCurrentAgentId(): string | null {
		return this.currentAgentId;
	}

	async setSessionMode(sessionId: string, modeId: string): Promise<void> {
		await setSessionModeOperation({
			connection: this.connection,
			logger: this.logger,
			sessionId,
			modeId,
		});
	}

	async setSessionModel(sessionId: string, modelId: string): Promise<void> {
		await setSessionModelOperation({
			connection: this.connection,
			logger: this.logger,
			sessionId,
			modelId,
		});
	}

	onSessionUpdate(callback: (update: SessionUpdate) => void): void {
		this.sessionUpdateCallback = callback;
	}

	onError(callback: (error: ProcessError) => void): void {
		this.errorCallback = callback;
	}

	respondToPermission(requestId: string, optionId: string): Promise<void> {
		if (!this.connection) {
			throw new Error(
				"ACP connection not initialized. Call initialize() first.",
			);
		}

		this.logger.log(
			"[AcpAdapter] Responding to permission request:",
			requestId,
			"with option:",
			optionId,
		);
		this.handlePermissionResponse(requestId, optionId);
		return Promise.resolve();
	}

	private getErrorInfo(
		error: Error,
		command: string,
		agentLabel: string,
	): { title: string; message: string; suggestion: string } {
		return getSpawnErrorInfo(error, command, agentLabel);
	}

	private getCommandNotFoundSuggestion(command: string): string {
		return getCommandNotFoundSuggestion(command);
	}

	private extractStderrErrorHint(): string | null {
		return extractStderrErrorHint(this.recentStderr);
	}

	sessionUpdate(params: acp.SessionNotification): Promise<void> {
		const update = params.update;
		const sessionId = params.sessionId;
		this.promptSessionUpdateCount++;
		this.logger.log("[AcpAdapter] sessionUpdate:", { sessionId, update });

		if (this.sessionUpdateCallback) {
			routeSessionUpdate(update, sessionId, this.sessionUpdateCallback);
		}
		return Promise.resolve();
	}

	resetCurrentMessage(): void {
		this.currentMessageId = null;
	}

	handlePermissionResponse(requestId: string, optionId: string): void {
		handlePermissionResponseOperation({
			state: {
				pendingPermissionRequests: this.pendingPermissionRequests,
				pendingPermissionQueue: this.pendingPermissionQueue,
			},
			requestId,
			optionId,
			updateMessage: this.updateMessage,
		});
	}

	cancelAllOperations(): void {
		this.cancelPendingPermissionRequests();

		this.terminalManager.killAllTerminals();
	}

	private activateNextPermission(): void {
		activateNextPermissionOperation({
			state: {
				pendingPermissionRequests: this.pendingPermissionRequests,
				pendingPermissionQueue: this.pendingPermissionQueue,
			},
			updateMessage: this.updateMessage,
		});
	}

	async requestPermission(
		params: acp.RequestPermissionRequest,
	): Promise<acp.RequestPermissionResponse> {
		return await requestPermissionOperation({
			params,
			logger: this.logger,
			autoAllowPermissions: this.autoAllowPermissions,
			state: {
				pendingPermissionRequests: this.pendingPermissionRequests,
				pendingPermissionQueue: this.pendingPermissionQueue,
			},
			updateMessage: this.updateMessage,
			sessionUpdateCallback: this.sessionUpdateCallback,
		});
	}

	private cancelPendingPermissionRequests(): void {
		cancelPendingPermissionRequestsOperation({
			state: {
				pendingPermissionRequests: this.pendingPermissionRequests,
				pendingPermissionQueue: this.pendingPermissionQueue,
			},
			logger: this.logger,
			updateMessage: this.updateMessage,
		});
	}

	readTextFile(params: acp.ReadTextFileRequest) {
		return Promise.resolve({ content: "" });
	}

	writeTextFile(params: acp.WriteTextFileRequest) {
		return Promise.resolve({});
	}

	createTerminal(
		params: acp.CreateTerminalRequest,
	): Promise<acp.CreateTerminalResponse> {
		return Promise.resolve(
			createTerminalOperation({
				params,
				logger: this.logger,
				terminalManager: this.terminalManager,
				currentConfig: this.currentConfig,
			}),
		);
	}

	terminalOutput(
		params: acp.TerminalOutputRequest,
	): Promise<acp.TerminalOutputResponse> {
		return Promise.resolve(
			terminalOutputOperation({
				params,
				terminalManager: this.terminalManager,
			}),
		);
	}

	async waitForTerminalExit(
		params: acp.WaitForTerminalExitRequest,
	): Promise<acp.WaitForTerminalExitResponse> {
		return await waitForTerminalExitOperation({
			params,
			terminalManager: this.terminalManager,
		});
	}

	killTerminal(
		params: acp.KillTerminalCommandRequest,
	): Promise<acp.KillTerminalCommandResponse> {
		return Promise.resolve(
			killTerminalOperation({
				params,
				terminalManager: this.terminalManager,
			}),
		);
	}

	releaseTerminal(
		params: acp.ReleaseTerminalRequest,
	): Promise<acp.ReleaseTerminalResponse> {
		return Promise.resolve(
			releaseTerminalOperation({
				params,
				logger: this.logger,
				terminalManager: this.terminalManager,
			}),
		);
	}

	async listSessions(
		cwd?: string,
		cursor?: string,
	): Promise<ListSessionsResult> {
		return await listSessionsOperation({
			connection: this.connection,
			logger: this.logger,
			windowsWslMode: this.plugin.settings.windowsWslMode,
			cwd,
			cursor,
		});
	}

	async loadSession(
		sessionId: string,
		cwd: string,
	): Promise<LoadSessionResult> {
		return await loadSessionOperation({
			connection: this.connection,
			logger: this.logger,
			windowsWslMode: this.plugin.settings.windowsWslMode,
			sessionId,
			cwd,
		});
	}

	async resumeSession(
		sessionId: string,
		cwd: string,
	): Promise<ResumeSessionResult> {
		return await resumeSessionOperation({
			connection: this.connection,
			logger: this.logger,
			windowsWslMode: this.plugin.settings.windowsWslMode,
			sessionId,
			cwd,
		});
	}

	async forkSession(
		sessionId: string,
		cwd: string,
	): Promise<ForkSessionResult> {
		return await forkSessionOperation({
			connection: this.connection,
			logger: this.logger,
			windowsWslMode: this.plugin.settings.windowsWslMode,
			sessionId,
			cwd,
		});
	}
}
