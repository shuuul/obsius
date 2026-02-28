import type {
	ChatSession,
	SessionModeState,
	SessionModelState,
	SlashCommand,
} from "../../domain/models/chat-session";

export interface AgentInfo {
	id: string;
	displayName: string;
}

export interface SessionErrorInfo {
	title: string;
	message: string;
	suggestion?: string;
}

export interface UseAgentSessionReturn {
	session: ChatSession;
	isReady: boolean;
	errorInfo: SessionErrorInfo | null;
	createSession: (overrideAgentId?: string) => Promise<void>;
	loadSession: (sessionId: string) => Promise<void>;
	restartSession: (newAgentId?: string) => Promise<void>;
	closeSession: () => Promise<void>;
	forceRestartAgent: () => Promise<void>;
	cancelOperation: () => Promise<void>;
	getAvailableAgents: () => AgentInfo[];
	updateSessionFromLoad: (
		sessionId: string,
		modes?: SessionModeState,
		models?: SessionModelState,
	) => void;
	updateAvailableCommands: (commands: SlashCommand[]) => void;
	updateCurrentMode: (modeId: string) => void;
	setMode: (modeId: string) => Promise<void>;
	setModel: (modelId: string) => Promise<void>;
}
