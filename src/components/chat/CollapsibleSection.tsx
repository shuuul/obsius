import * as React from "react";
const { useState } = React;

interface CollapsibleSectionProps {
	className?: string;
	header: React.ReactNode;
	defaultExpanded?: boolean;
	children: React.ReactNode;
}

export function CollapsibleSection({
	className,
	header,
	defaultExpanded = false,
	children,
}: CollapsibleSectionProps) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	return (
		<div
			className={`ac-collapsible ${expanded ? "ac-collapsible--expanded" : ""} ${className ?? ""}`}
		>
			<div
				className="ac-collapsible__header"
				role="button"
				tabIndex={0}
				aria-expanded={expanded}
				onClick={() => setExpanded((v) => !v)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setExpanded((v) => !v);
					}
				}}
			>
				{header}
			</div>
			{expanded && <div className="ac-collapsible__body">{children}</div>}
		</div>
	);
}
