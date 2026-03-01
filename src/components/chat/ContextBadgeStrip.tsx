import * as React from "react";
import { ObsidianIcon } from "./ObsidianIcon";

export interface ContextBadgeItem {
	id: string;
	iconName: string;
	label: string;
	title?: string;
	onClick?: () => void;
	onRemove?: () => void;
}

interface ContextBadgeStripProps {
	items: ContextBadgeItem[];
	className?: string;
}

export function ContextBadgeStrip({
	items,
	className,
}: ContextBadgeStripProps): React.ReactElement | null {
	if (items.length === 0) {
		return null;
	}

	return (
		<div
			className={className ?? "obsius-input-context-badge-strip"}
			data-context-badge-strip="true"
		>
			{items.map((item) => {
				const clickable = typeof item.onClick === "function";
				return (
					<span
						key={item.id}
						className={`obsius-inline-mention-badge obsius-inline-context-badge${clickable ? " obsius-inline-context-badge-clickable" : ""}`}
						title={item.title ?? item.label}
						onClick={() => item.onClick?.()}
						role={clickable ? "button" : undefined}
						tabIndex={clickable ? 0 : undefined}
						onKeyDown={(e) => {
							if (!clickable) return;
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								item.onClick?.();
							}
						}}
					>
						<ObsidianIcon
							name={item.iconName}
							className="obsius-inline-mention-icon"
							size={12}
						/>
						<span className="obsius-inline-mention-name">{item.label}</span>
						{item.onRemove && (
							<span
								className="obsius-context-chip-remove"
								onClick={(e) => {
									e.stopPropagation();
									item.onRemove?.();
								}}
								role="button"
								tabIndex={0}
								title="Remove context"
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										e.stopPropagation();
										item.onRemove?.();
									}
								}}
							>
								<ObsidianIcon name="x" size={12} />
							</span>
						)}
					</span>
				);
			})}
		</div>
	);
}
