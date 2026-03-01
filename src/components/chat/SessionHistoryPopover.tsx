import * as React from "react";
const { useEffect, useRef } = React;
import { setIcon } from "obsidian";
import {
	SessionHistoryContent,
	type SessionHistoryContentProps,
} from "./SessionHistoryContent";

type SessionHistoryPopoverProps = SessionHistoryContentProps;

export function SessionHistoryPopover({
	onClose,
	...contentProps
}: SessionHistoryPopoverProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const closeIconRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (closeIconRef.current) {
			setIcon(closeIconRef.current, "x");
		}
	}, []);

	useEffect(() => {
		const onDocumentMouseDown = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (!target) {
				return;
			}

			const element = target as HTMLElement;
			if (element.closest(".obsius-history-anchor")) {
				return;
			}

			if (containerRef.current && !containerRef.current.contains(target)) {
				onClose();
			}
		};

		const onDocumentKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		};

		document.addEventListener("mousedown", onDocumentMouseDown, true);
		document.addEventListener("keydown", onDocumentKeyDown);

		return () => {
			document.removeEventListener("mousedown", onDocumentMouseDown, true);
			document.removeEventListener("keydown", onDocumentKeyDown);
		};
	}, [onClose]);

	return (
		<div className="obsius-session-history-popover" ref={containerRef}>
			<div className="obsius-session-history-popover-header">
				<span className="obsius-session-history-popover-title">
					CONVERSATIONS
				</span>
				<button
					className="obsius-session-history-popover-close"
					aria-label="Close conversations"
					onClick={onClose}
				>
					<div
						ref={closeIconRef}
						className="obsius-session-history-popover-close-icon"
						aria-hidden="true"
					/>
				</button>
			</div>
			<div className="obsius-session-history-popover-content">
				<SessionHistoryContent {...contentProps} onClose={onClose} />
			</div>
		</div>
	);
}
