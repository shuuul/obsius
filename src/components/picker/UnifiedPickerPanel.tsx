import * as React from "react";
import type { UsePickerReturn } from "../../hooks/usePicker";
import {
	type PickerItem,
	type PickerMode,
	type PickerTreeNode,
} from "./types";
import { ObsidianIcon } from "../chat/ObsidianIcon";

const { useRef, useEffect, useCallback } = React;

interface UnifiedPickerPanelProps {
	picker: UsePickerReturn;
	mode: PickerMode;
	onKeyDown?: (e: React.KeyboardEvent) => boolean;
}

function MentionItemRow({
	item,
	isSelected,
	onClick,
	onHover,
}: {
	item: PickerItem;
	isSelected: boolean;
	onClick: () => void;
	onHover: () => void;
}) {
	return (
		<div
			className={`obsius-picker-item ${isSelected ? "obsius-picker-item--selected" : ""}`}
			data-selected={isSelected}
			onClick={onClick}
			onMouseEnter={onHover}
		>
			<ObsidianIcon
				name={item.icon}
				className="obsius-picker-item-icon"
				size={16}
			/>
			<div className="obsius-picker-item-text">
				<span className="obsius-picker-item-label">{item.label}</span>
				{item.sublabel && (
					<span className="obsius-picker-item-sublabel">
						{item.sublabel}
					</span>
				)}
			</div>
		</div>
	);
}

function CommandItemRow({
	item,
	isSelected,
	onClick,
	onHover,
}: {
	item: PickerItem;
	isSelected: boolean;
	onClick: () => void;
	onHover: () => void;
}) {
	return (
		<div
			className={`obsius-picker-item ${isSelected ? "obsius-picker-item--selected" : ""}`}
			data-selected={isSelected}
			onClick={onClick}
			onMouseEnter={onHover}
		>
			{item.badge && (
				<span className="obsius-picker-badge">
					<ObsidianIcon
						name={item.badge.icon}
						className="obsius-picker-badge-icon"
						size={10}
					/>
					{item.badge.label}
				</span>
			)}
			<div className="obsius-picker-item-text">
				<span className="obsius-picker-item-label">{item.label}</span>
				{item.sublabel && (
					<span className="obsius-picker-item-sublabel">
						{item.sublabel}
					</span>
				)}
			</div>
			{item.description && (
				<span className="obsius-picker-item-desc">{item.description}</span>
			)}
		</div>
	);
}

function TreePreview({ nodes }: { nodes: PickerTreeNode[] }) {
	return (
		<div className="obsius-picker-tree">
			{nodes.map((node, i) => (
				<TreeNode key={i} node={node} depth={0} />
			))}
		</div>
	);
}

function TreeNode({ node, depth }: { node: PickerTreeNode; depth: number }) {
	return (
		<>
			<div
				className="obsius-picker-tree-node"
				style={{ paddingLeft: `${depth * 16 + 8}px` }}
			>
				<ObsidianIcon name={node.icon} size={14} />
				<span>{node.name}</span>
			</div>
			{node.children?.map((child, i) => (
				<TreeNode key={i} node={child} depth={depth + 1} />
			))}
		</>
	);
}

function DetailPane({
	preview,
	mode,
}: {
	preview: UsePickerReturn["preview"];
	mode: PickerMode;
}) {
	if (!preview) {
		return (
			<div className="obsius-picker-detail obsius-picker-detail--empty">
				<span className="obsius-picker-detail-empty-text">
					{mode === "mention"
						? "Select a file to see its path"
						: "Select a command for details"}
				</span>
			</div>
		);
	}

	if (preview.tree && preview.tree.length > 0) {
		return (
			<div className="obsius-picker-detail">
				<TreePreview nodes={preview.tree} />
			</div>
		);
	}

	return (
		<div className="obsius-picker-detail">
			<div className="obsius-picker-detail-title">{preview.title}</div>
			<div className="obsius-picker-detail-body">{preview.body}</div>
		</div>
	);
}

function ItemList({
	items,
	selectedIndex,
	listRef,
	mode,
	onSelect,
	onHover,
}: {
	items: PickerItem[];
	selectedIndex: number;
	listRef: React.RefObject<HTMLDivElement | null>;
	mode: PickerMode;
	onSelect: (index: number) => void;
	onHover: (index: number) => void;
}) {
	const Row = mode === "mention" ? MentionItemRow : CommandItemRow;

	return (
		<div className="obsius-picker-list" ref={listRef}>
			{items.length === 0 && (
				<div className="obsius-picker-empty">No results</div>
			)}
			{items.map((item, idx) => (
				<Row
					key={item.id}
					item={item}
					isSelected={idx === selectedIndex}
					onClick={() => onSelect(idx)}
					onHover={() => onHover(idx)}
				/>
			))}
		</div>
	);
}

export function UnifiedPickerPanel({
	picker,
	mode,
	onKeyDown,
}: UnifiedPickerPanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	useEffect(() => {
		if (!listRef.current) return;
		const selected =
			listRef.current.querySelector<HTMLElement>("[data-selected='true']");
		selected?.scrollIntoView({ block: "nearest" });
	}, [picker.selectedIndex]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (onKeyDown?.(e)) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				picker.navigate("down");
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				picker.navigate("up");
			} else if (e.key === "Enter") {
				e.preventDefault();
				picker.selectCurrent();
			} else if (e.key === "Escape") {
				e.preventDefault();
				picker.close();
			}
		},
		[picker, onKeyDown],
	);

	const handleItemSelect = useCallback(
		(index: number) => {
			picker.selectAt(index);
		},
		[picker],
	);

	const handleItemHover = useCallback(
		(index: number) => {
			picker.setSelectedIndex(index);
		},
		[picker],
	);

	const placeholder =
		mode === "mention"
			? "Search files, folders..."
			: "Search commands, tools, skills...";

	const listPane = (
		<ItemList
			items={picker.items}
			selectedIndex={picker.selectedIndex}
			listRef={listRef}
			mode={mode}
			onSelect={handleItemSelect}
			onHover={handleItemHover}
		/>
	);

	const detailPane = <DetailPane preview={picker.preview} mode={mode} />;

	return (
		<div
			className={`obsius-picker-panel obsius-picker-panel--${mode}`}
			ref={panelRef}
			onKeyDown={handleKeyDown}
		>
			<div className="obsius-picker-search">
				<ObsidianIcon
					name="search"
					className="obsius-picker-search-icon"
					size={14}
				/>
				<input
					ref={inputRef}
					type="text"
					className="obsius-picker-search-input"
					placeholder={placeholder}
					value={picker.query}
					onChange={(e) => picker.setQuery(e.target.value)}
				/>
			</div>

			<div className="obsius-picker-body">
				{listPane}
				{detailPane}
			</div>
		</div>
	);
}
