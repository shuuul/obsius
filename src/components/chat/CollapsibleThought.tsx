import * as React from "react";
import type AgentClientPlugin from "../../plugin";
import { MarkdownTextRenderer } from "./MarkdownTextRenderer";
import { CollapsibleSection } from "./CollapsibleSection";
import { ObsidianIcon } from "./ObsidianIcon";

interface CollapsibleThoughtProps {
	text: string;
	plugin: AgentClientPlugin;
}

const SHORT_THOUGHT_MAX_CHARS = 120;
const SHORT_THOUGHT_MAX_LINES = 2;

export function CollapsibleThought({ text, plugin }: CollapsibleThoughtProps) {
	const normalized = text.trim();
	const lineCount = normalized.split(/\r?\n/).length;
	const isShortThought =
		normalized.length <= SHORT_THOUGHT_MAX_CHARS &&
		lineCount <= SHORT_THOUGHT_MAX_LINES;

	if (isShortThought) {
		return (
			<div className="ac-thought-inline">
				<ObsidianIcon name="brain" className="ac-tool-icon" />
				<span className="ac-row__title ac-thought__label">Thinking</span>
				<span className="ac-thought-inline-text">{normalized}</span>
			</div>
		);
	}

	return (
		<CollapsibleSection
			className="ac-thought ac-thought--long"
			defaultExpanded={false}
			header={
				<>
					<ObsidianIcon name="brain" className="ac-tool-icon" />
					<span className="ac-row__title ac-thought__label">Thinking</span>
				</>
			}
		>
			<div className="ac-tree__item">
				<MarkdownTextRenderer text={text} plugin={plugin} />
			</div>
		</CollapsibleSection>
	);
}
