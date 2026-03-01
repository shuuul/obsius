import * as React from "react";
const { useRef, useEffect, useImperativeHandle, forwardRef } = React;
import { setIcon } from "obsidian";

interface HeaderButtonProps {
	iconName: string;
	tooltip: string;
	onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
	className?: string;
	ariaExpanded?: boolean;
}

export const HeaderButton = forwardRef<HTMLButtonElement, HeaderButtonProps>(
	function HeaderButton(
		{ iconName, tooltip, onClick, className, ariaExpanded },
		ref,
	) {
		const buttonRef = useRef<HTMLButtonElement>(null);

		// Expose the button ref to parent components
		useImperativeHandle(ref, () => buttonRef.current!, []);

		useEffect(() => {
			if (buttonRef.current) {
				setIcon(buttonRef.current, iconName);
			}
		}, [iconName]);

		return (
			<button
				ref={buttonRef}
				title={tooltip}
				onClick={onClick}
				className={`obsius-header-button${className ? ` ${className}` : ""}`}
				aria-expanded={ariaExpanded}
			/>
		);
	},
);
