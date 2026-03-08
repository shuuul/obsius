import * as React from "react";
const { useEffect, useRef, useCallback } = React;
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
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (closeIconRef.current) {
			setIcon(closeIconRef.current, "x");
		}
	}, []);

	useEffect(() => {
		previousFocusRef.current = document.activeElement as HTMLElement | null;

		const firstFocusable = containerRef.current?.querySelector<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		firstFocusable?.focus();

		return () => {
			previousFocusRef.current?.focus();
		};
	}, []);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
				return;
			}

			if (event.key !== "Tab" || !containerRef.current) return;

			const focusable = containerRef.current.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		},
		[onClose],
	);

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

		document.addEventListener("mousedown", onDocumentMouseDown, true);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("mousedown", onDocumentMouseDown, true);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose, handleKeyDown]);

	return (
		<div
			className="obsius-session-history-popover"
			ref={containerRef}
			role="dialog"
			aria-label="Conversations"
		>
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
