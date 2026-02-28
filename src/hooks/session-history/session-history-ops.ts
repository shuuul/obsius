import type { IAgentClient } from "../../domain/ports/agent-client.port";
import type { ISettingsAccess } from "../../domain/ports/settings-access.port";
import type {
	ChatSession,
	SessionModeState,
	SessionModelState,
} from "../../domain/models/chat-session";
import type { SessionInfo } from "../../domain/models/session-info";
import type { ChatMessage } from "../../domain/models/chat-message";
import type { ListSessionsResult, SavedSessionInfo } from "../../domain/models/session-info";

function mergeWithLocalTitles(
	agentSessions: SessionInfo[],
	localSessions: SavedSessionInfo[],
): SessionInfo[] {
	const localMap = new Map(localSessions.map((session) => [session.sessionId, session]));
	return agentSessions.map((session) => ({
		...session,
		title: localMap.get(session.sessionId)?.title ?? session.title,
	}));
}

interface FetchSessionsOperationParams {
	agentClient: IAgentClient;
	settingsAccess: ISettingsAccess;
	sessionAgentId: string | null;
	cwd?: string;
}

export async function fetchSessionsOperation({
	agentClient,
	settingsAccess,
	sessionAgentId,
	cwd,
}: FetchSessionsOperationParams): Promise<{
	sessions: SessionInfo[];
	localSessionIds: Set<string>;
	nextCursor?: string;
}> {
	const result: ListSessionsResult = await agentClient.listSessions(cwd);
	const localSessions = settingsAccess.getSavedSessions(
		sessionAgentId ?? undefined,
		cwd,
	);
	return {
		sessions: mergeWithLocalTitles(result.sessions, localSessions),
		localSessionIds: new Set(localSessions.map((session) => session.sessionId)),
		nextCursor: result.nextCursor,
	};
}

interface LoadMoreSessionsOperationParams {
	agentClient: IAgentClient;
	settingsAccess: ISettingsAccess;
	sessionAgentId: string | null;
	cwd?: string;
	cursor: string;
}

export async function loadMoreSessionsOperation({
	agentClient,
	settingsAccess,
	sessionAgentId,
	cwd,
	cursor,
}: LoadMoreSessionsOperationParams): Promise<{
	sessions: SessionInfo[];
	localSessionIds: Set<string>;
	nextCursor?: string;
}> {
	const result: ListSessionsResult = await agentClient.listSessions(cwd, cursor);
	const localSessions = settingsAccess.getSavedSessions(
		sessionAgentId ?? undefined,
		cwd,
	);
	return {
		sessions: mergeWithLocalTitles(result.sessions, localSessions),
		localSessionIds: new Set(localSessions.map((session) => session.sessionId)),
		nextCursor: result.nextCursor,
	};
}

interface RestoreSessionOperationParams {
	agentClient: IAgentClient;
	settingsAccess: ISettingsAccess;
	capabilities: { canLoad: boolean; canResume: boolean };
	sessionId: string;
	cwd: string;
	onSessionLoad: (
		sessionId: string,
		modes?: SessionModeState,
		models?: SessionModelState,
	) => void;
	onMessagesRestore?: (messages: ChatMessage[]) => void;
	onLoadStart?: () => void;
	onLoadEnd?: () => void;
}

export async function restoreSessionOperation({
	agentClient,
	settingsAccess,
	capabilities,
	sessionId,
	cwd,
	onSessionLoad,
	onMessagesRestore,
	onLoadStart,
	onLoadEnd,
}: RestoreSessionOperationParams): Promise<void> {
	onSessionLoad(sessionId, undefined, undefined);

	if (capabilities.canLoad) {
		onLoadStart?.();
		try {
			const localMessagesPromise = settingsAccess.loadSessionMessages(sessionId);
			const result = await agentClient.loadSession(sessionId, cwd);
			onSessionLoad(result.sessionId, result.modes, result.models);

			const localMessages = await localMessagesPromise;
			if (localMessages && onMessagesRestore) {
				onMessagesRestore(localMessages);
			}
		} finally {
			onLoadEnd?.();
		}
		return;
	}

	if (capabilities.canResume) {
		const result = await agentClient.resumeSession(sessionId, cwd);
		onSessionLoad(result.sessionId, result.modes, result.models);
		const localMessages = await settingsAccess.loadSessionMessages(sessionId);
		if (localMessages && onMessagesRestore) {
			onMessagesRestore(localMessages);
		}
		return;
	}

	throw new Error("Session restoration is not supported");
}

function getForkedSessionTitle(originalTitle: string): string {
	const maxTitleLength = 50;
	const prefix = "Fork: ";
	const maxBaseLength = maxTitleLength - prefix.length;
	const truncatedTitle =
		originalTitle.length > maxBaseLength
			? originalTitle.substring(0, maxBaseLength) + "..."
			: originalTitle;
	return `${prefix}${truncatedTitle}`;
}

interface ForkSessionOperationParams {
	agentClient: IAgentClient;
	settingsAccess: ISettingsAccess;
	session: ChatSession;
	sessions: SessionInfo[];
	sessionId: string;
	cwd: string;
	onSessionLoad: (
		sessionId: string,
		modes?: SessionModeState,
		models?: SessionModelState,
	) => void;
	onMessagesRestore?: (messages: ChatMessage[]) => void;
	invalidateCache: () => void;
}

export async function forkSessionOperation({
	agentClient,
	settingsAccess,
	session,
	sessions,
	sessionId,
	cwd,
	onSessionLoad,
	onMessagesRestore,
	invalidateCache,
}: ForkSessionOperationParams): Promise<void> {
	const result = await agentClient.forkSession(sessionId, cwd);
	onSessionLoad(result.sessionId, result.modes, result.models);

	const localMessages = await settingsAccess.loadSessionMessages(sessionId);
	if (localMessages && onMessagesRestore) {
		onMessagesRestore(localMessages);
	}

	if (session.agentId) {
		const originalSession = sessions.find((s) => s.sessionId === sessionId);
		const originalTitle = originalSession?.title ?? "Session";
		const now = new Date().toISOString();

		await settingsAccess.saveSession({
			sessionId: result.sessionId,
			agentId: session.agentId,
			cwd,
			title: getForkedSessionTitle(originalTitle),
			createdAt: now,
			updatedAt: now,
		});

		if (localMessages) {
			void settingsAccess.saveSessionMessages(
				result.sessionId,
				session.agentId,
				localMessages,
			);
		}
	}

	invalidateCache();
}
