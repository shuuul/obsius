import * as React from "react";
import type AgentClientPlugin from "../../plugin";
import { MarkdownTextRenderer } from "./MarkdownTextRenderer";
import { CollapsibleSection } from "./CollapsibleSection";
import { ObsidianIcon } from "./ObsidianIcon";

interface CollapsibleThoughtProps {
	text: string;
	plugin: AgentClientPlugin;
}

export function CollapsibleThought({ text, plugin }: CollapsibleThoughtProps) {
	return (
		<CollapsibleSection
			className="ac-thought"
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
