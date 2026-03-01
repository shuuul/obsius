import * as React from "react";
const { useRef, useState, useCallback, useEffect, useMemo } = React;
import { createPortal } from "react-dom";

import { ObsidianIcon } from "../ObsidianIcon";

export interface SelectorOption {
	id: string;
	label: string;
	description?: string;
	/** Lucide icon name (rendered via ObsidianIcon) */
	icon?: string;
	/** Custom React element that takes precedence over `icon` */
	iconElement?: React.ReactNode;
}

interface SelectorButtonProps {
	options: SelectorOption[];
	currentValue: string;
	onChange: (value: string) => void;
	className?: string;
	title?: string;
}

export function SelectorButton({
	options,
	currentValue,
	onChange,
	className,
	title,
}: SelectorButtonProps) {
	const buttonRef = useRef<HTMLDivElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);

	const currentOption = useMemo(
		() => options.find((o) => o.id === currentValue),
		[options, currentValue],
	);

	const handleToggle = useCallback(() => {
		setIsOpen((prev) => !prev);
	}, []);

	const handleSelect = useCallback(
		(id: string) => {
			onChange(id);
			setIsOpen(false);
		},
		[onChange],
	);

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				!popoverRef.current?.contains(target) &&
				!buttonRef.current?.contains(target)
			) {
				setIsOpen(false);
			}
		};
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsOpen(false);
		};
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen]);

	const popoverStyle = useMemo<React.CSSProperties>(() => {
		if (!isOpen || !buttonRef.current) return {};
		const rect = buttonRef.current.getBoundingClientRect();
		return {
			position: "fixed",
			left: rect.left,
			bottom: window.innerHeight - rect.top + 4,
		};
	}, [isOpen]);

	return (
		<>
			<div
				ref={buttonRef}
				className={`obsius-selector-button ${isOpen ? "obsius-selector-active" : ""} ${className ?? ""}`}
				onClick={handleToggle}
				title={title}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleToggle();
					}
				}}
			>
				{currentOption?.iconElement ? (
					<span className="obsius-selector-icon">
						{currentOption.iconElement}
					</span>
				) : currentOption?.icon ? (
					<ObsidianIcon
						name={currentOption.icon}
						className="obsius-selector-icon"
						size={14}
					/>
				) : null}
				<span className="obsius-selector-label">
					{currentOption?.label ?? "Select"}
				</span>
				<ObsidianIcon
					name="chevron-down"
					className="obsius-selector-chevron"
					size={10}
				/>
			</div>
			{isOpen &&
				createPortal(
					<div
						ref={popoverRef}
						className="obsius-selector-popover"
						style={popoverStyle}
					>
						{options.map((option) => (
							<div
								key={option.id}
								className={`obsius-selector-option ${option.id === currentValue ? "is-selected" : ""}`}
								onClick={() => handleSelect(option.id)}
								role="option"
								aria-selected={option.id === currentValue}
							>
								{option.iconElement ? (
									<span className="obsius-selector-option-icon">
										{option.iconElement}
									</span>
								) : option.icon ? (
									<ObsidianIcon
										name={option.icon}
										className="obsius-selector-option-icon"
										size={16}
									/>
								) : null}
								<span className="obsius-selector-option-label">
									{option.label}
								</span>
								{option.id === currentValue && (
									<ObsidianIcon
										name="check"
										className="obsius-selector-option-check"
										size={16}
									/>
								)}
							</div>
						))}
					</div>,
					document.body,
				)}
		</>
	);
}
