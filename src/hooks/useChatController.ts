import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { FileSystemAdapter } from "obsidian";

import type { AttachedImage } from "../components/chat/ImagePreviewStrip";
import { pluginNotice } from "../shared/plugin-notice";
import { SessionHistoryModal } from "../components/chat/SessionHistoryModal";

import { NoteMentionService } from "../adapters/obsidian/mention-service";
import { getLogger } from "../shared/logger";
import { ChatExporter } from "../shared/chat-exporter";

import { ObsidianVaultAdapter } from "../adapters/obsidian/vault.adapter";

import { useSettings } from "./useSettings";
import { useMentions } from "./useMentions";
import { useSlashCommands } from "./useSlashCommands";
import { useAutoMention } from "./useAutoMention";
import { useAgentSession } from "./useAgentSession";
import { useChat } from "./useChat";
import { usePermission } from "./usePermission";
import { useAutoExport } from "./useAutoExport";
import { useSessionHistory } from "./useSessionHistory";
import {
	type UseChatControllerOptions,
	type UseChatControllerReturn,
} from "./chat-controller/types";
import { useSessionHistoryHandlers } from "./chat-controller/session-history-handlers";

import type {
	SessionModeState,
	SessionModelState,
} from "../domain/models/chat-session";
import type { ImagePromptContent } from "../domain/models/prompt-content";

export function useChatController(
	options: UseChatControllerOptions,
): UseChatControllerReturn {
	const { plugin, viewId, initialAgentId, config } = options;

	const logger = getLogger();

	const vaultPath = useMemo(() => {
		if (options.workingDirectory) {
			return options.workingDirectory;
		}
		const adapter = plugin.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}
		return process.cwd();
	}, [plugin, options.workingDirectory]);

	const noteMentionService = useMemo(
		() => new NoteMentionService(plugin),
		[plugin],
	);

	useEffect(() => {
		return () => {
			noteMentionService.destroy();
		};
	}, [noteMentionService]);

	const acpAdapter = useMemo(
		() => plugin.getOrCreateAdapter(viewId),
		[plugin, viewId],
	);

	const vaultAccessAdapter = useMemo(() => {
		return new ObsidianVaultAdapter(plugin, noteMentionService);
	}, [plugin, noteMentionService]);

	const settings = useSettings(plugin);

	const agentSession = useAgentSession(
		acpAdapter,
		plugin.settingsStore,
		vaultPath,
		initialAgentId,
	);

	const {
		session,
		errorInfo: sessionErrorInfo,
		isReady: isSessionReady,
	} = agentSession;

	const chat = useChat(
		acpAdapter,
		vaultAccessAdapter,
		noteMentionService,
		{
			sessionId: session.sessionId,
			authMethods: session.authMethods,
			promptCapabilities: session.promptCapabilities,
		},
		{
			windowsWslMode: settings.windowsWslMode,
			maxNoteLength: settings.displaySettings.maxNoteLength,
			maxSelectionLength: settings.displaySettings.maxSelectionLength,
		},
	);

	const { messages, isSending } = chat;

	const permission = usePermission(acpAdapter, messages);

	const mentions = useMentions(vaultAccessAdapter, plugin);
	const autoMention = useAutoMention(vaultAccessAdapter);
	const slashCommands = useSlashCommands(
		session.availableCommands || [],
		autoMention.toggle,
	);

	const autoExport = useAutoExport(plugin);

	const handleSessionLoad = useCallback(
		(
			sessionId: string,
			modes?: SessionModeState,
			models?: SessionModelState,
		) => {
			logger.log(
				`[useChatController] Session loaded/resumed/forked: ${sessionId}`,
				{
					modes,
					models,
				},
			);
			agentSession.updateSessionFromLoad(sessionId, modes, models);
		},
		[logger, agentSession],
	);

	const [isLoadingSessionHistory, setIsLoadingSessionHistory] =
		useState(false);

	const handleLoadStart = useCallback(() => {
		logger.log(
			"[useChatController] session/load started, ignoring history replay",
		);
		setIsLoadingSessionHistory(true);
		chat.clearMessages();
	}, [logger, chat]);

	const handleLoadEnd = useCallback(() => {
		logger.log(
			"[useChatController] session/load ended, resuming normal processing",
		);
		setIsLoadingSessionHistory(false);
	}, [logger]);

	const sessionHistory = useSessionHistory({
		agentClient: acpAdapter,
		session,
		settingsAccess: plugin.settingsStore,
		cwd: vaultPath,
		onSessionLoad: handleSessionLoad,
		onMessagesRestore: chat.setMessagesFromLocal,
		onLoadStart: handleLoadStart,
		onLoadEnd: handleLoadEnd,
	});

	const errorInfo =
		sessionErrorInfo || chat.errorInfo || permission.errorInfo;

	const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
	const [restoredMessage, setRestoredMessage] = useState<string | null>(null);

	const [inputValue, setInputValue] = useState("");
	const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

	const historyModalRef = useRef<SessionHistoryModal | null>(null);

	const activeAgentLabel = useMemo(() => {
		const activeId = session.agentId;
		if (activeId === plugin.settings.claude.id) {
			return (
				plugin.settings.claude.displayName || plugin.settings.claude.id
			);
		}
		if (activeId === plugin.settings.opencode.id) {
			return (
				plugin.settings.opencode.displayName || plugin.settings.opencode.id
			);
		}
		if (activeId === plugin.settings.codex.id) {
			return (
				plugin.settings.codex.displayName || plugin.settings.codex.id
			);
		}
		if (activeId === plugin.settings.gemini.id) {
			return (
				plugin.settings.gemini.displayName || plugin.settings.gemini.id
			);
		}
		const custom = plugin.settings.customAgents.find(
			(agent) => agent.id === activeId,
		);
		return custom?.displayName || custom?.id || activeId;
	}, [session.agentId, plugin.settings]);

	const availableAgents = useMemo(() => {
		return plugin.getAvailableAgents();
	}, [plugin]);

	const handleSendMessage = useCallback(
		async (content: string, images?: ImagePromptContent[]) => {
			const isFirstMessage = messages.length === 0;

			await chat.sendMessage(content, {
				activeNote: settings.autoMentionActiveNote
					? autoMention.activeNote
					: null,
				vaultBasePath: vaultPath,
				isAutoMentionDisabled: autoMention.isDisabled,
				images,
			});

			if (isFirstMessage && session.sessionId) {
				await sessionHistory.saveSessionLocally(
					session.sessionId,
					content,
				);
				logger.log(
					`[useChatController] Session saved locally: ${session.sessionId}`,
				);
			}
		},
		[
			chat,
			autoMention,
			plugin,
			messages.length,
			session.sessionId,
			sessionHistory,
			logger,
			settings.autoMentionActiveNote,
		],
	);

	const handleStopGeneration = useCallback(async () => {
		logger.log("Cancelling current operation...");
		const lastMessage = chat.lastUserMessage;
		await agentSession.cancelOperation();
		if (lastMessage) {
			setRestoredMessage(lastMessage);
		}
	}, [logger, agentSession, chat.lastUserMessage]);

	const handleNewChat = useCallback(
		async (requestedAgentId?: string) => {
			const isAgentSwitch =
				requestedAgentId && requestedAgentId !== session.agentId;

			if (messages.length === 0 && !isAgentSwitch) {
				pluginNotice("Already a new session");
				return;
			}

			if (chat.isSending) {
				await agentSession.cancelOperation();
			}

			logger.log(
				`[Debug] Creating new session${isAgentSwitch ? ` with agent: ${requestedAgentId}` : ""}...`,
			);

			if (messages.length > 0) {
				await autoExport.autoExportIfEnabled(
					"newChat",
					messages,
					session,
				);
			}

			autoMention.toggle(false);
			chat.clearMessages();

			const newAgentId = isAgentSwitch
				? requestedAgentId
				: session.agentId;
			await agentSession.restartSession(newAgentId);

			sessionHistory.invalidateCache();
		},
		[
			messages,
			session,
			logger,
			autoExport,
			autoMention,
			chat,
			agentSession,
			sessionHistory,
		],
	);

	const handleExportChat = useCallback(async () => {
		if (messages.length === 0) {
			pluginNotice("No messages to export");
			return;
		}

		try {
			const exporter = new ChatExporter(plugin);
			const openFile = plugin.settings.exportSettings.openFileAfterExport;
			const filePath = await exporter.exportToMarkdown(
				messages,
				session.agentDisplayName,
				session.agentId,
				session.sessionId || "unknown",
				session.createdAt,
				openFile,
			);
			pluginNotice(`Chat exported to ${filePath}`);
		} catch (error) {
			pluginNotice("Failed to export chat");
			logger.error("Export error:", error);
		}
	}, [messages, session, plugin, logger]);

	const handleSwitchAgent = useCallback(
		async (agentId: string) => {
			if (agentId !== session.agentId) {
				await handleNewChat(agentId);
			}
		},
		[session.agentId, handleNewChat],
	);

	const handleRestartAgent = useCallback(async () => {
		logger.log("[useChatController] Restarting agent process...");

		if (messages.length > 0) {
			await autoExport.autoExportIfEnabled("newChat", messages, session);
		}

		chat.clearMessages();

		try {
			await agentSession.forceRestartAgent();
			pluginNotice("Agent restarted");
		} catch (error) {
			pluginNotice("Failed to restart agent");
			logger.error("Restart error:", error);
		}
	}, [logger, messages, session, autoExport, chat, agentSession]);

	const handleClearError = useCallback(() => {
		chat.clearError();
	}, [chat]);

	const handleRestoredMessageConsumed = useCallback(() => {
		setRestoredMessage(null);
	}, []);

	const {
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleOpenHistory,
	} = useSessionHistoryHandlers({
		app: plugin.app,
		sessionHistory,
		logger,
		vaultPath,
		isSessionReady,
		debugMode: settings.debugMode,
		clearMessages: chat.clearMessages,
		historyModalRef,
	});

	const handleSetMode = useCallback(
		async (modeId: string) => {
			await agentSession.setMode(modeId);
		},
		[agentSession],
	);

	const handleSetModel = useCallback(
		async (modelId: string) => {
			await agentSession.setModel(modelId);
		},
		[agentSession],
	);

	useEffect(() => {
		logger.log("[Debug] Starting connection setup via useAgentSession...");
		void agentSession.createSession(config?.agent || initialAgentId);
	}, [agentSession.createSession, config?.agent, initialAgentId]);

	useEffect(() => {
		if (config?.model && isSessionReady && session.models) {
			const modelExists = session.models.availableModels.some(
				(m) => m.modelId === config.model,
			);
			if (modelExists && session.models.currentModelId !== config.model) {
				logger.log(
					"[useChatController] Applying configured model:",
					config.model,
				);
				void agentSession.setModel(config.model);
			}
		}
	}, [
		config?.model,
		isSessionReady,
		session.models,
		agentSession.setModel,
		logger,
	]);

	const messagesRef = useRef(messages);
	const sessionRef = useRef(session);
	const autoExportRef = useRef(autoExport);
	const closeSessionRef = useRef(agentSession.closeSession);
	messagesRef.current = messages;
	sessionRef.current = session;
	autoExportRef.current = autoExport;
	closeSessionRef.current = agentSession.closeSession;

	useEffect(() => {
		return () => {
			logger.log(
				"[useChatController] Cleanup: auto-export and close session",
			);
			void (async () => {
				await autoExportRef.current.autoExportIfEnabled(
					"closeChat",
					messagesRef.current,
					sessionRef.current,
				);
				await closeSessionRef.current();
			})();
		};
	}, [logger]);

	useEffect(() => {
		acpAdapter.onSessionUpdate((update) => {
			if (session.sessionId && update.sessionId !== session.sessionId) {
				logger.log(
					`[useChatController] Ignoring update for old session: ${update.sessionId} (current: ${session.sessionId})`,
				);
				return;
			}

			if (isLoadingSessionHistory) {
				if (update.type === "available_commands_update") {
					agentSession.updateAvailableCommands(update.commands);
				} else if (update.type === "current_mode_update") {
					agentSession.updateCurrentMode(update.currentModeId);
				}
				return;
			}

			chat.handleSessionUpdate(update);

			if (update.type === "available_commands_update") {
				agentSession.updateAvailableCommands(update.commands);
			} else if (update.type === "current_mode_update") {
				agentSession.updateCurrentMode(update.currentModeId);
			}
		});
	}, [
		acpAdapter,
		session.sessionId,
		logger,
		isLoadingSessionHistory,
		chat.handleSessionUpdate,
		agentSession.updateAvailableCommands,
		agentSession.updateCurrentMode,
	]);

	useEffect(() => {
		acpAdapter.setUpdateMessageCallback(chat.updateMessage);
	}, [acpAdapter, chat.updateMessage]);

	useEffect(() => {
		plugin
			.checkForUpdates()
			.then(setIsUpdateAvailable)
			.catch((error) => {
				logger.error("Failed to check for updates:", error);
			});
	}, [plugin, logger]);

	const prevIsSendingRef = useRef<boolean>(false);

	useEffect(() => {
		const wasSending = prevIsSendingRef.current;
		prevIsSendingRef.current = isSending;

		if (
			wasSending &&
			!isSending &&
			session.sessionId &&
			messages.length > 0
		) {
			sessionHistory.saveSessionMessages(session.sessionId, messages);
			logger.log(
				`[useChatController] Session messages saved: ${session.sessionId}`,
			);
		}
	}, [isSending, session.sessionId, messages, sessionHistory, logger]);

	useEffect(() => {
		let isMounted = true;

		const refreshActiveNote = async () => {
			if (!isMounted) return;
			await autoMention.updateActiveNote();
		};

		const unsubscribe = vaultAccessAdapter.subscribeSelectionChanges(() => {
			void refreshActiveNote();
		});

		void refreshActiveNote();

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [autoMention.updateActiveNote, vaultAccessAdapter]);

	return {
		logger,
		vaultPath,
		acpAdapter,
		vaultAccessAdapter,
		noteMentionService,

		settings,
		session,
		isSessionReady,
		messages,
		isSending,
		isUpdateAvailable,
		isLoadingSessionHistory,

		permission,
		mentions,
		autoMention,
		slashCommands,
		sessionHistory,
		autoExport,

		activeAgentLabel,
		availableAgents,
		errorInfo,

		handleSendMessage,
		handleStopGeneration,
		handleNewChat,
		handleExportChat,
		handleSwitchAgent,
		handleRestartAgent,
		handleClearError,
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleOpenHistory,
		handleSetMode,
		handleSetModel,

		inputValue,
		setInputValue,
		attachedImages,
		setAttachedImages,
		restoredMessage,
		handleRestoredMessageConsumed,

		historyModalRef,
	};
}
