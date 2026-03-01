import * as React from "react";
const { useState, useRef, useEffect } = React;
import type { IAcpClient } from "../../adapters/acp/acp.adapter";
import { getLogger } from "../../shared/logger";
import type AgentClientPlugin from "../../plugin";
import { CollapsibleSection } from "./CollapsibleSection";

interface TerminalRendererProps {
	terminalId: string;
	acpClient: IAcpClient | null;
	plugin: AgentClientPlugin;
}

export function TerminalRenderer({
	terminalId,
	acpClient,
	plugin,
}: TerminalRendererProps) {
	const logger = getLogger();
	const [output, setOutput] = useState("");
	const [exitStatus, setExitStatus] = useState<{
		exitCode: number | null;
		signal: string | null;
	} | null>(null);
	const [isRunning, setIsRunning] = useState(true);
	const [isCancelled, setIsCancelled] = useState(false);
	const intervalRef = useRef<number | null>(null);

	logger.log(
		`[TerminalRenderer] Component rendered for terminal ${terminalId}, acpClient: ${!!acpClient}`,
	);

	useEffect(() => {
		logger.log(
			`[TerminalRenderer] useEffect triggered for ${terminalId}, acpClient: ${!!acpClient}`,
		);
		if (!terminalId || !acpClient) return;

		const pollOutput = async () => {
			try {
				const result = await acpClient.terminalOutput({
					terminalId,
					sessionId: "",
				});
				logger.log(`[TerminalRenderer] Poll result for ${terminalId}:`, result);
				setOutput(result.output);
				if (result.exitStatus) {
					setExitStatus({
						exitCode: result.exitStatus.exitCode ?? null,
						signal: result.exitStatus.signal ?? null,
					});
					setIsRunning(false);
					if (intervalRef.current) {
						window.clearInterval(intervalRef.current);
						intervalRef.current = null;
					}
				}
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);

				logger.log(
					`[TerminalRenderer] Polling error for terminal ${terminalId}: ${errorMessage}`,
				);

				if (errorMessage.includes("not found") && !exitStatus) {
					setIsCancelled(true);
				}

				setIsRunning(false);
				if (intervalRef.current) {
					window.clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
			}
		};

		void pollOutput();

		intervalRef.current = window.setInterval(() => {
			void pollOutput();
		}, 100);

		return () => {
			if (intervalRef.current) {
				window.clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [terminalId, acpClient, logger]);

	useEffect(() => {
		if (!isRunning && intervalRef.current) {
			window.clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, [isRunning]);

	const statusLabel = isRunning
		? "running"
		: isCancelled
			? "cancelled"
			: "finished";
	const statusClass = isRunning
		? "ac-status--running"
		: isCancelled
			? "ac-status--error"
			: "ac-status--completed";

	const header = (
		<>
			<span className="ac-row__title">Terminal {terminalId.slice(0, 8)}</span>
			{exitStatus?.exitCode != null && (
				<span className="ac-row__summary">exit {exitStatus.exitCode}</span>
			)}
			<span className={`ac-status ${statusClass}`}>{statusLabel}</span>
		</>
	);

	return (
		<CollapsibleSection
			className="ac-terminal"
			defaultExpanded={false}
			header={header}
		>
			<div className="ac-tree__item">
				<pre className="ac-terminal__output">
					{output || (isRunning ? "Waiting for output..." : "No output")}
				</pre>
			</div>
			{exitStatus && (
				<div className="ac-tree__item">
					<span
						className={`ac-terminal__exit ${exitStatus.exitCode === 0 ? "ac-terminal__exit--ok" : "ac-terminal__exit--err"}`}
					>
						Exit Code: {exitStatus.exitCode}
						{exitStatus.signal && ` | Signal: ${exitStatus.signal}`}
					</span>
				</div>
			)}
		</CollapsibleSection>
	);
}
