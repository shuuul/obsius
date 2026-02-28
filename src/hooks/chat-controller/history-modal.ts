import type { SessionInfo } from "../../domain/models/session-info";

interface HistoryModalParams {
	sessions: SessionInfo[];
	loading: boolean;
	error: string | null;
	hasMore: boolean;
	currentCwd: string;
	canList: boolean;
	canRestore: boolean;
	canFork: boolean;
	isUsingLocalSessions: boolean;
	localSessionIds: Set<string>;
	isAgentReady: boolean;
	debugMode: boolean;
	onRestoreSession: (sessionId: string, cwd: string) => Promise<void>;
	onForkSession: (sessionId: string, cwd: string) => Promise<void>;
	onDeleteSession: (sessionId: string) => void;
	onLoadMore: () => void;
	onFetchSessions: (cwd?: string) => void;
}

export function buildHistoryModalProps(params: HistoryModalParams) {
	return {
		sessions: params.sessions,
		loading: params.loading,
		error: params.error,
		hasMore: params.hasMore,
		currentCwd: params.currentCwd,
		canList: params.canList,
		canRestore: params.canRestore,
		canFork: params.canFork,
		isUsingLocalSessions: params.isUsingLocalSessions,
		localSessionIds: params.localSessionIds,
		isAgentReady: params.isAgentReady,
		debugMode: params.debugMode,
		onRestoreSession: params.onRestoreSession,
		onForkSession: params.onForkSession,
		onDeleteSession: params.onDeleteSession,
		onLoadMore: params.onLoadMore,
		onFetchSessions: params.onFetchSessions,
	};
}
