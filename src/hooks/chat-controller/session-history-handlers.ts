import { useCallback, useState } from "react";
import { App } from "obsidian";

import { ConfirmDeleteModal } from "../../components/chat/ConfirmDeleteModal";
import { pluginNotice } from "../../shared/plugin-notice";
import type { SessionInfo } from "../../domain/models/session-info";
import type { Logger } from "../../shared/logger";

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
	clearMessages: () => void;
}

export function useSessionHistoryHandlers(
	params: UseSessionHistoryHandlersParams,
) {
	const { app, sessionHistory, logger, vaultPath, clearMessages } = params;

	const [isHistoryPopoverOpen, setIsHistoryPopoverOpen] = useState(false);

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

	const handleOpenHistory = useCallback(() => {
		setIsHistoryPopoverOpen((prev) => {
			const next = !prev;
			if (next) {
				void sessionHistory.fetchSessions(vaultPath);
			}
			return next;
		});
	}, [sessionHistory, vaultPath]);

	const handleCloseHistory = useCallback(() => {
		setIsHistoryPopoverOpen(false);
	}, []);

	return {
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleLoadMore,
		handleFetchSessions,
		handleOpenHistory,
		handleCloseHistory,
		isHistoryPopoverOpen,
	};
}
