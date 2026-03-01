import { useCallback, useEffect, useMemo } from "react";
import { App } from "obsidian";
import type * as React from "react";

import { ConfirmDeleteModal } from "../../components/chat/ConfirmDeleteModal";
import { pluginNotice } from "../../shared/plugin-notice";
import { SessionHistoryModal } from "../../components/chat/SessionHistoryModal";
import type { SessionInfo } from "../../domain/models/session-info";
import type { Logger } from "../../shared/logger";

import { buildHistoryModalProps } from "./history-modal";

interface SessionHistoryControllerState {
	sessions: SessionInfo[];
	loading: boolean;
	error: string | null;
	hasMore: boolean;
	canList: boolean;
	canRestore: boolean;
	canFork: boolean;
	isUsingLocalSessions: boolean;
	localSessionIds: Set<string>;
	restoreSession: (sessionId: string, cwd: string) => Promise<void>;
	forkSession: (sessionId: string, cwd: string) => Promise<void>;
	deleteSession: (sessionId: string) => Promise<void>;
	loadMoreSessions: () => Promise<void>;
	fetchSessions: (cwd?: string) => Promise<void>;
}

interface UseSessionHistoryHandlersParams {
	app: App;
	sessionHistory: SessionHistoryControllerState;
	logger: Logger;
	vaultPath: string;
	isSessionReady: boolean;
	debugMode: boolean;
	clearMessages: () => void;
	historyModalRef: React.RefObject<SessionHistoryModal | null>;
}

export function useSessionHistoryHandlers(
	params: UseSessionHistoryHandlersParams,
) {
	const {
		app,
		sessionHistory,
		logger,
		vaultPath,
		isSessionReady,
		debugMode,
		clearMessages,
		historyModalRef,
	} = params;

	const handleRestoreSession = useCallback(
		async (sessionId: string, cwd: string) => {
			try {
				logger.log(`[useChatController] Restoring session: ${sessionId}`);
				clearMessages();
				await sessionHistory.restoreSession(sessionId, cwd);
				pluginNotice("Session restored");
			} catch (error) {
				pluginNotice("Failed to restore session");
				logger.error("Session restore error:", error);
			}
		},
		[clearMessages, logger, sessionHistory],
	);

	const handleForkSession = useCallback(
		async (sessionId: string, cwd: string) => {
			try {
				logger.log(`[useChatController] Forking session: ${sessionId}`);
				clearMessages();
				await sessionHistory.forkSession(sessionId, cwd);
				pluginNotice("Session forked");
			} catch (error) {
				pluginNotice("Failed to fork session");
				logger.error("Session fork error:", error);
			}
		},
		[clearMessages, logger, sessionHistory],
	);

	const handleDeleteSession = useCallback(
		(sessionId: string) => {
			const targetSession = sessionHistory.sessions.find(
				(s) => s.sessionId === sessionId,
			);
			const sessionTitle = targetSession?.title ?? "Untitled Session";

			const confirmModal = new ConfirmDeleteModal(
				app,
				sessionTitle,
				async () => {
					try {
						logger.log(`[useChatController] Deleting session: ${sessionId}`);
						await sessionHistory.deleteSession(sessionId);
						pluginNotice("Session deleted");
					} catch (error) {
						pluginNotice("Failed to delete session");
						logger.error("Session delete error:", error);
					}
				},
			);
			confirmModal.open();
		},
		[app, logger, sessionHistory],
	);

	const handleLoadMore = useCallback(() => {
		void sessionHistory.loadMoreSessions();
	}, [sessionHistory]);

	const handleFetchSessions = useCallback(
		(cwd?: string) => {
			void sessionHistory.fetchSessions(cwd);
		},
		[sessionHistory],
	);

	const historyModalProps = useMemo(
		() =>
			buildHistoryModalProps({
				sessions: sessionHistory.sessions,
				loading: sessionHistory.loading,
				error: sessionHistory.error,
				hasMore: sessionHistory.hasMore,
				currentCwd: vaultPath,
				canList: sessionHistory.canList,
				canRestore: sessionHistory.canRestore,
				canFork: sessionHistory.canFork,
				isUsingLocalSessions: sessionHistory.isUsingLocalSessions,
				localSessionIds: sessionHistory.localSessionIds,
				isAgentReady: isSessionReady,
				debugMode,
				onRestoreSession: handleRestoreSession,
				onForkSession: handleForkSession,
				onDeleteSession: handleDeleteSession,
				onLoadMore: handleLoadMore,
				onFetchSessions: handleFetchSessions,
			}),
		[
			sessionHistory.sessions,
			sessionHistory.loading,
			sessionHistory.error,
			sessionHistory.hasMore,
			sessionHistory.canList,
			sessionHistory.canRestore,
			sessionHistory.canFork,
			sessionHistory.isUsingLocalSessions,
			sessionHistory.localSessionIds,
			vaultPath,
			isSessionReady,
			debugMode,
			handleRestoreSession,
			handleForkSession,
			handleDeleteSession,
			handleLoadMore,
			handleFetchSessions,
		],
	);

	const handleOpenHistory = useCallback(() => {
		if (!historyModalRef.current) {
			historyModalRef.current = new SessionHistoryModal(app, historyModalProps);
		}
		historyModalRef.current.open();
		void sessionHistory.fetchSessions(vaultPath);
	}, [app, historyModalProps, historyModalRef, sessionHistory, vaultPath]);

	useEffect(() => {
		if (historyModalRef.current) {
			historyModalRef.current.updateProps(historyModalProps);
		}
	}, [historyModalProps, historyModalRef]);

	return {
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleOpenHistory,
	};
}
