import * as React from "react";
const { useState, useCallback } = React;
import { setIcon } from "obsidian";
import type { SessionInfo } from "../../domain/models/session-info";

/**
 * Props for SessionHistoryContent component.
 */
export interface SessionHistoryContentProps {
	/** List of sessions to display */
	sessions: SessionInfo[];
	/** Whether sessions are being fetched */
	loading: boolean;
	/** Error message if fetch fails */
	error: string | null;
	/** Whether there are more sessions to load */
	hasMore: boolean;
	/** Current working directory for filtering */
	currentCwd: string;
	/** Current active session ID */
	currentSessionId?: string | null;

	// Capability flags (from useSessionHistory)
	/** Whether session/list is supported (unstable) */
	canList: boolean;
	/** Whether session can be restored (load or resume supported) */
	canRestore: boolean;
	/** Whether session/fork is supported (unstable) */
	canFork: boolean;

	/** Whether using locally saved sessions (instead of agent session/list) */
	isUsingLocalSessions: boolean;

	/** Set of session IDs that have local data (for filtering) */
	localSessionIds: Set<string>;

	/** Whether the agent is ready (initialized) */
	isAgentReady: boolean;

	/** Whether debug mode is enabled (shows manual input form) */
	debugMode: boolean;

	/** Callback when a session is restored */
	onRestoreSession: (sessionId: string, cwd: string) => Promise<void>;
	/** Callback when a session is forked (create new branch) */
	onForkSession: (sessionId: string, cwd: string) => Promise<void>;
	/** Callback when a session is deleted (shows confirmation dialog) */
	onDeleteSession: (sessionId: string) => void;
	/** Callback to load more sessions (pagination) */
	onLoadMore: () => void;
	/** Callback to fetch sessions with filter */
	onFetchSessions: (cwd?: string) => void;
	/** Callback to close the popover */
	onClose: () => void;
}

/**
 * Icon button component using Obsidian's setIcon.
 */
function IconButton({
	iconName,
	label,
	className,
	onClick,
}: {
	iconName: string;
	label: string;
	className: string;
	onClick: (e: React.MouseEvent) => void;
}) {
	const iconRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (iconRef.current) {
			setIcon(iconRef.current, iconName);
		}
	}, [iconName]);

	return (
		<div
			ref={iconRef}
			className={className}
			aria-label={label}
			onClick={onClick}
		/>
	);
}

function RowIcon({
	iconName,
	className,
}: {
	iconName: string;
	className: string;
}) {
	const iconRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (iconRef.current) {
			setIcon(iconRef.current, iconName);
		}
	}, [iconName]);

	return <div ref={iconRef} className={className} aria-hidden="true" />;
}

/**
 * Format timestamp as relative time.
 * Examples: "2 hours ago", "yesterday", "3 days ago"
 */
function formatRelativeTime(date: Date): string {
	const now = Date.now();
	const timestamp = date.getTime();
	const diffMs = now - timestamp;
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMinutes < 1) {
		return "just now";
	} else if (diffMinutes < 60) {
		return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
	} else if (diffHours < 24) {
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	} else if (diffDays === 1) {
		return "yesterday";
	} else if (diffDays < 7) {
		return `${diffDays} days ago`;
	} else {
		const month = date.toLocaleString("default", { month: "short" });
		const day = date.getDate();
		const year = date.getFullYear();
		return `${month} ${day}, ${year}`;
	}
}

/**
 * Truncate session title to 50 characters with ellipsis.
 */
function truncateTitle(title: string): string {
	if (title.length <= 50) {
		return title;
	}
	return title.slice(0, 50) + "...";
}

/**
 * Debug form for manual session input.
 */
function DebugForm({
	currentCwd,
	onRestoreSession,
	onForkSession,
	onClose,
}: {
	currentCwd: string;
	onRestoreSession: (sessionId: string, cwd: string) => Promise<void>;
	onForkSession: (sessionId: string, cwd: string) => Promise<void>;
	onClose: () => void;
}) {
	const [sessionId, setSessionId] = useState("");
	const [cwd, setCwd] = useState(currentCwd);

	const handleRestore = useCallback(() => {
		if (sessionId.trim()) {
			onClose();
			void onRestoreSession(sessionId.trim(), cwd.trim() || currentCwd);
		}
	}, [sessionId, cwd, currentCwd, onRestoreSession, onClose]);

	const handleFork = useCallback(() => {
		if (sessionId.trim()) {
			onClose();
			void onForkSession(sessionId.trim(), cwd.trim() || currentCwd);
		}
	}, [sessionId, cwd, currentCwd, onForkSession, onClose]);

	return (
		<div className="obsius-session-history-debug">
			<h3>Debug: Manual Session Input</h3>

			<div className="obsius-session-history-debug-group">
				<label htmlFor="debug-session-id">Session ID:</label>
				<input
					id="debug-session-id"
					type="text"
					placeholder="Enter session ID..."
					className="obsius-session-history-debug-input"
					value={sessionId}
					onChange={(e) => setSessionId(e.target.value)}
				/>
			</div>

			<div className="obsius-session-history-debug-group">
				<label htmlFor="debug-cwd">Working Directory (cwd):</label>
				<input
					id="debug-cwd"
					type="text"
					placeholder="Enter working directory..."
					className="obsius-session-history-debug-input"
					value={cwd}
					onChange={(e) => setCwd(e.target.value)}
				/>
			</div>

			<div className="obsius-session-history-debug-actions">
				<button
					className="obsius-session-history-debug-button"
					onClick={handleRestore}
				>
					Restore
				</button>
				<button
					className="obsius-session-history-debug-button"
					onClick={handleFork}
				>
					Fork
				</button>
			</div>

			<hr className="obsius-session-history-debug-separator" />
		</div>
	);
}

/**
 * Session list item component.
 *
 * Clicking the item loads (restores) the session.
 * The branch button creates a new branch from the session.
 */
function SessionItem({
	session,
	isCurrent,
	canRestore,
	canFork,
	onRestoreSession,
	onForkSession,
	onDeleteSession,
	onClose,
}: {
	session: SessionInfo;
	isCurrent: boolean;
	canRestore: boolean;
	canFork: boolean;
	onRestoreSession: (sessionId: string, cwd: string) => Promise<void>;
	onForkSession: (sessionId: string, cwd: string) => Promise<void>;
	onDeleteSession: (sessionId: string) => void;
	onClose: () => void;
}) {
	const handleClick = useCallback(() => {
		if (!canRestore) return;
		onClose();
		void onRestoreSession(session.sessionId, session.cwd);
	}, [session, canRestore, onRestoreSession, onClose]);

	const handleFork = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onClose();
			void onForkSession(session.sessionId, session.cwd);
		},
		[session, onForkSession, onClose],
	);

	const handleDelete = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onDeleteSession(session.sessionId);
		},
		[session.sessionId, onDeleteSession],
	);

	return (
		<div
			className={`obsius-session-history-item${canRestore ? " obsius-session-history-item--clickable" : ""}${isCurrent ? " obsius-session-history-item--current" : ""}`}
			onClick={handleClick}
			role={canRestore ? "button" : undefined}
			tabIndex={canRestore ? 0 : undefined}
			onKeyDown={(e) => {
				if (canRestore && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					handleClick();
				}
			}}
		>
			<RowIcon
				iconName={isCurrent ? "message-square-dot" : "message-square"}
				className="obsius-session-history-item-icon"
			/>

			<div className="obsius-session-history-item-content">
				<div className="obsius-session-history-item-title">
					<span>{truncateTitle(session.title ?? "Untitled Session")}</span>
				</div>
				<div className="obsius-session-history-item-metadata">
					{isCurrent ? (
						<span className="obsius-session-history-item-current">
							Current session
						</span>
					) : (
						session.updatedAt && (
							<span className="obsius-session-history-item-timestamp">
								{formatRelativeTime(new Date(session.updatedAt))}
							</span>
						)
					)}
				</div>
			</div>

			<div className="obsius-session-history-item-actions">
				{canFork && (
					<IconButton
						iconName="git-branch"
						label="Branch from this session"
						className="obsius-session-history-action-icon obsius-session-history-fork-icon"
						onClick={handleFork}
					/>
				)}
				<IconButton
					iconName="trash-2"
					label="Delete session"
					className="obsius-session-history-action-icon obsius-session-history-delete-icon"
					onClick={handleDelete}
				/>
			</div>
		</div>
	);
}

/**
 * Session history content component.
 *
 * Renders the content of the session history modal including:
 * - Debug form (when debug mode enabled)
 * - Local sessions banner
 * - Filter toggle (for agent session/list)
 * - Session list with load/resume/fork actions
 * - Pagination
 */
export function SessionHistoryContent({
	sessions,
	loading,
	error,
	hasMore,
	currentCwd,
	currentSessionId,
	canList,
	canRestore,
	canFork,
	isUsingLocalSessions,
	localSessionIds,
	isAgentReady,
	debugMode,
	onRestoreSession,
	onForkSession,
	onDeleteSession,
	onLoadMore,
	onFetchSessions,
	onClose,
}: SessionHistoryContentProps) {
	const handleRetry = useCallback(() => {
		onFetchSessions(currentCwd);
	}, [currentCwd, onFetchSessions]);

	// When using agent session/list, only keep sessions that already have local data.
	// This mirrors the fixed UI behavior (no user toggles in the popover).
	const filteredSessions = React.useMemo(() => {
		if (isUsingLocalSessions) {
			return sessions;
		}
		return sessions.filter((s) => localSessionIds.has(s.sessionId));
	}, [sessions, isUsingLocalSessions, localSessionIds]);

	// Show preparing message if agent is not ready
	if (!isAgentReady) {
		return (
			<div className="obsius-session-history-loading">
				<p>Preparing agent...</p>
			</div>
		);
	}

	// Check if any session operation is available
	const canPerformAnyOperation = canRestore || canFork;

	// Show local sessions list (always show for delete functionality)
	// - If agent supports list: use agent's session/list
	// - If agent doesn't support list OR doesn't support restoration: use locally saved sessions
	const canShowList =
		canList || isUsingLocalSessions || !canPerformAnyOperation;

	return (
		<>
			{/* Debug form */}
			{debugMode && (
				<DebugForm
					currentCwd={currentCwd}
					onRestoreSession={onRestoreSession}
					onForkSession={onForkSession}
					onClose={onClose}
				/>
			)}

			{/* Warning banner for agents that don't support restoration */}
			{!canPerformAnyOperation && (
				<div className="obsius-session-history-warning-banner">
					<p>This agent does not support session restoration.</p>
				</div>
			)}

			{/* Local sessions banner */}
			{(isUsingLocalSessions || !canPerformAnyOperation) && (
				<div className="obsius-session-history-local-banner">
					<span>These sessions are saved in the plugin.</span>
				</div>
			)}

			{/* No list capability message */}
			{!canShowList && !debugMode && (
				<div className="obsius-session-history-empty">
					<p className="obsius-session-history-empty-text">
						Session list is not available for this agent.
					</p>
					<p className="obsius-session-history-empty-text">
						Enable Debug Mode in settings to manually enter session IDs.
					</p>
				</div>
			)}

			{canShowList && (
				<>
					{/* Error state */}
					{error && (
						<div className="obsius-session-history-error">
							<p className="obsius-session-history-error-text">{error}</p>
							<button
								className="obsius-session-history-retry-button"
								onClick={handleRetry}
							>
								Retry
							</button>
						</div>
					)}

					{/* Loading state */}
					{!error && loading && filteredSessions.length === 0 && (
						<div className="obsius-session-history-loading">
							<p>Loading sessions...</p>
						</div>
					)}

					{/* Empty state */}
					{!error && !loading && filteredSessions.length === 0 && (
						<div className="obsius-session-history-empty">
							<p className="obsius-session-history-empty-text">
								No previous sessions
							</p>
						</div>
					)}

					{/* Session list */}
					{!error && filteredSessions.length > 0 && (
						<div className="obsius-session-history-list">
							{filteredSessions.map((session) => (
								<SessionItem
									key={session.sessionId}
									session={session}
									isCurrent={session.sessionId === currentSessionId}
									canRestore={canRestore}
									canFork={canFork}
									onRestoreSession={onRestoreSession}
									onForkSession={onForkSession}
									onDeleteSession={onDeleteSession}
									onClose={onClose}
								/>
							))}
						</div>
					)}

					{/* Load more button */}
					{!error && hasMore && (
						<div className="obsius-session-history-load-more">
							<button
								className="obsius-session-history-load-more-button"
								disabled={loading}
								onClick={onLoadMore}
							>
								{loading ? "Loading..." : "Load more"}
							</button>
						</div>
					)}
				</>
			)}
		</>
	);
}
