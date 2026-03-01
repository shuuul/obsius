import * as React from "react";

interface DiffViewerProps {
	oldText: string;
	newText: string;
	filePath?: string;
	maxHeight?: number;
}

export function DiffViewer({
	oldText,
	newText,
	filePath,
	maxHeight = 400,
}: DiffViewerProps) {
	const diff = formatLineDiff(oldText, newText);

	return (
		<div className="obsius-diff-viewer">
			{filePath && <div className="obsius-diff-viewer-header">{filePath}</div>}
			<pre
				className="obsius-diff-viewer-content"
				style={{ maxHeight: `${maxHeight}px` }}
			>
				{diff.map((line, i) => (
					<div
						key={i}
						className={`obsius-diff-line ${
							line.type === "add"
								? "obsius-diff-line--add"
								: line.type === "remove"
									? "obsius-diff-line--remove"
									: ""
						}`}
					>
						<span className="obsius-diff-line-prefix">
							{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
						</span>
						<span className="obsius-diff-line-text">{line.text}</span>
					</div>
				))}
			</pre>
		</div>
	);
}

interface DiffLine {
	type: "add" | "remove" | "context";
	text: string;
}

function formatLineDiff(oldText: string, newText: string): DiffLine[] {
	const oldLines = oldText.split("\n");
	const newLines = newText.split("\n");
	const result: DiffLine[] = [];

	const maxLen = Math.max(oldLines.length, newLines.length);
	for (let i = 0; i < maxLen; i++) {
		const oldLine = oldLines[i];
		const newLine = newLines[i];
		if (oldLine === newLine) {
			result.push({ type: "context", text: oldLine ?? "" });
		} else {
			if (oldLine !== undefined) {
				result.push({ type: "remove", text: oldLine });
			}
			if (newLine !== undefined) {
				result.push({ type: "add", text: newLine });
			}
		}
	}

	return result;
}
