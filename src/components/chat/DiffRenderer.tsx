import * as React from "react";
const { useState, useMemo } = React;
import * as Diff from "diff";
import type AgentClientPlugin from "../../plugin";

interface DiffRendererProps {
	diff: {
		type: "diff";
		path: string;
		oldText?: string | null;
		newText: string;
	};
	plugin: AgentClientPlugin;
	autoCollapse?: boolean;
	collapseThreshold?: number;
}

/**
 * Represents a single line in a diff view
 * @property type - The type of change: added, removed, or unchanged context
 * @property oldLineNumber - Line number in the old file (undefined for added lines)
 * @property newLineNumber - Line number in the new file (undefined for removed lines)
 * @property content - The text content of the line
 * @property wordDiff - Optional word-level diff for lines that were modified (adjacent removed+added pairs)
 */
interface DiffLine {
	type: "added" | "removed" | "context";
	oldLineNumber?: number;
	newLineNumber?: number;
	content: string;
	wordDiff?: { type: "added" | "removed" | "context"; value: string }[];
}

function isNewFile(diff: DiffRendererProps["diff"]): boolean {
	return (
		diff.oldText === null || diff.oldText === undefined || diff.oldText === ""
	);
}

function mapDiffParts(
	parts: Diff.Change[],
): { type: "added" | "removed" | "context"; value: string }[] {
	return parts.map((part) => ({
		type: part.added ? "added" : part.removed ? "removed" : "context",
		value: part.value,
	}));
}

function renderWordDiff(
	wordDiff: { type: "added" | "removed" | "context"; value: string }[],
	lineType: "added" | "removed",
) {
	const filteredParts = wordDiff.filter((part) => {
		if (lineType === "removed" && part.type === "added") {
			return false;
		}
		if (lineType === "added" && part.type === "removed") {
			return false;
		}
		return true;
	});

	return (
		<>
			{filteredParts.map((part, partIdx) => {
				if (part.type === "added") {
					return (
						<span key={partIdx} className="agent-client-diff-word-added">
							{part.value}
						</span>
					);
				} else if (part.type === "removed") {
					return (
						<span key={partIdx} className="agent-client-diff-word-removed">
							{part.value}
						</span>
					);
				}
				return <span key={partIdx}>{part.value}</span>;
			})}
		</>
	);
}

const CONTEXT_LINES = 3;

export function DiffRenderer({
	diff,
	autoCollapse = false,
	collapseThreshold = 10,
}: DiffRendererProps) {
	const diffLines = useMemo(() => {
		if (isNewFile(diff)) {
			const lines = diff.newText.split("\n");
			return lines.map(
				(line, idx): DiffLine => ({
					type: "added",
					newLineNumber: idx + 1,
					content: line,
				}),
			);
		}

		// At this point, oldText is guaranteed to be a non-empty string (checked by isNewFile)
		const oldText = diff.oldText || "";
		const patch = Diff.structuredPatch(
			"old",
			"new",
			oldText,
			diff.newText,
			"",
			"",
			{ context: CONTEXT_LINES },
		);

		const result: DiffLine[] = [];
		let oldLineNum = 0;
		let newLineNum = 0;

		for (const hunk of patch.hunks) {
			if (patch.hunks.length > 1) {
				result.push({
					type: "context",
					content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
				});
			}

			oldLineNum = hunk.oldStart;
			newLineNum = hunk.newStart;

			for (const line of hunk.lines) {
				const marker = line[0];
				const content = line.substring(1);

				if (marker === "+") {
					result.push({
						type: "added",
						newLineNumber: newLineNum++,
						content,
					});
				} else if (marker === "-") {
					result.push({
						type: "removed",
						oldLineNumber: oldLineNum++,
						content,
					});
				} else {
					result.push({
						type: "context",
						oldLineNumber: oldLineNum++,
						newLineNumber: newLineNum++,
						content,
					});
				}
			}
		}

		for (let i = 0; i < result.length - 1; i++) {
			const current = result[i];
			const next = result[i + 1];

			if (current.type === "removed" && next.type === "added") {
				const wordDiff = Diff.diffWords(current.content, next.content);
				const mappedDiff = mapDiffParts(wordDiff);
				current.wordDiff = mappedDiff;
				next.wordDiff = mappedDiff;
			}
		}

		return result;
	}, [diff.oldText, diff.newText]);

	const renderLine = (line: DiffLine, idx: number) => {
		const isHunkHeader =
			line.type === "context" && line.content.startsWith("@@");

		if (isHunkHeader) {
			return (
				<div key={idx} className="agent-client-diff-hunk-header">
					{line.content}
				</div>
			);
		}

		let lineClass = "agent-client-diff-line";
		let marker = " ";

		if (line.type === "added") {
			lineClass += " agent-client-diff-line-added";
			marker = "+";
		} else if (line.type === "removed") {
			lineClass += " agent-client-diff-line-removed";
			marker = "-";
		} else {
			lineClass += " agent-client-diff-line-context";
		}

		return (
			<div key={idx} className={lineClass}>
				<span className="agent-client-diff-line-number agent-client-diff-line-number-old">
					{line.oldLineNumber ?? ""}
				</span>
				<span className="agent-client-diff-line-number agent-client-diff-line-number-new">
					{line.newLineNumber ?? ""}
				</span>
				<span className="agent-client-diff-line-marker">{marker}</span>
				<span className="agent-client-diff-line-content">
					{line.wordDiff && (line.type === "added" || line.type === "removed")
						? renderWordDiff(line.wordDiff, line.type)
						: line.content}
				</span>
			</div>
		);
	};

	const shouldCollapse = autoCollapse && diffLines.length > collapseThreshold;
	const [isCollapsed, setIsCollapsed] = useState(shouldCollapse);
	const visibleLines = isCollapsed
		? diffLines.slice(0, collapseThreshold)
		: diffLines;
	const remainingLines = diffLines.length - collapseThreshold;

	return (
		<div className="agent-client-tool-call-diff">
			{isNewFile(diff) ? (
				<div className="agent-client-diff-line-info">New file</div>
			) : null}
			<div className="agent-client-tool-call-diff-content">
				{visibleLines.map((line, idx) => renderLine(line, idx))}
			</div>
			{shouldCollapse && (
				<div
					className="agent-client-diff-expand-bar"
					onClick={() => setIsCollapsed(!isCollapsed)}
				>
					<span className="agent-client-diff-expand-text">
						{isCollapsed ? `${remainingLines} more lines` : "Collapse"}
					</span>
					<span className="agent-client-diff-expand-icon">
						{isCollapsed ? "▶" : "▲"}
					</span>
				</div>
			)}
		</div>
	);
}
