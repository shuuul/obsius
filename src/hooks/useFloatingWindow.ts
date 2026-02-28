import { useState, useRef, useEffect, useCallback } from "react";
import type AgentClientPlugin from "../plugin";
import { clampPosition } from "../shared/floating-utils";

interface FloatingWindowSize {
	width: number;
	height: number;
}

interface FloatingWindowPosition {
	x: number;
	y: number;
}

interface UseFloatingWindowParams {
	plugin: AgentClientPlugin;
	initialExpanded: boolean;
	initialPosition?: FloatingWindowPosition;
	settingsSize: FloatingWindowSize;
	settingsPosition: FloatingWindowPosition | null;
}

export interface UseFloatingWindowReturn {
	isExpanded: boolean;
	setIsExpanded: (expanded: boolean) => void;
	position: FloatingWindowPosition;
	size: FloatingWindowSize;
	isDragging: boolean;
	containerRef: React.RefObject<HTMLDivElement | null>;
	onMouseDown: (e: React.MouseEvent) => void;
}

export function useFloatingWindow({
	plugin,
	initialExpanded,
	initialPosition,
	settingsSize,
	settingsPosition,
}: UseFloatingWindowParams): UseFloatingWindowReturn {
	const [isExpanded, setIsExpanded] = useState(initialExpanded);
	const [size, setSize] = useState(settingsSize);
	const [position, setPosition] = useState(() => {
		if (initialPosition) {
			return clampPosition(
				initialPosition.x,
				initialPosition.y,
				settingsSize.width,
				settingsSize.height,
			);
		}
		if (settingsPosition) {
			return clampPosition(
				settingsPosition.x,
				settingsPosition.y,
				settingsSize.width,
				settingsSize.height,
			);
		}
		return clampPosition(
			window.innerWidth - settingsSize.width - 50,
			window.innerHeight - settingsSize.height - 50,
			settingsSize.width,
			settingsSize.height,
		);
	});
	const [isDragging, setIsDragging] = useState(false);
	const dragOffset = useRef({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);

	// Sync manual resizing with state
	useEffect(() => {
		if (!isExpanded || !containerRef.current) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				if (
					Math.abs(width - size.width) > 5 ||
					Math.abs(height - size.height) > 5
				) {
					setSize({ width, height });
				}
			}
		});

		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, [isExpanded, size.width, size.height]);

	// Debounced save of size to settings
	useEffect(() => {
		if (
			size.width === settingsSize.width &&
			size.height === settingsSize.height
		) {
			return;
		}
		const timer = setTimeout(() => {
			void plugin.saveSettingsAndNotify({
				...plugin.settings,
				floatingWindowSize: size,
			});
		}, 500);
		return () => clearTimeout(timer);
	}, [size, plugin, settingsSize]);

	// Debounced save of position to settings
	useEffect(() => {
		if (
			settingsPosition &&
			position.x === settingsPosition.x &&
			position.y === settingsPosition.y
		) {
			return;
		}
		const timer = setTimeout(() => {
			void plugin.saveSettingsAndNotify({
				...plugin.settings,
				floatingWindowPosition: position,
			});
		}, 500);
		return () => clearTimeout(timer);
	}, [position, plugin, settingsPosition]);

	// Drag start
	const onMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (!containerRef.current) return;
			setIsDragging(true);
			dragOffset.current = {
				x: e.clientX - position.x,
				y: e.clientY - position.y,
			};
		},
		[position],
	);

	// Drag move + release
	useEffect(() => {
		if (!isDragging) return;

		const onMouseMove = (e: MouseEvent) => {
			setPosition(
				clampPosition(
					e.clientX - dragOffset.current.x,
					e.clientY - dragOffset.current.y,
					size.width,
					size.height,
				),
			);
		};
		const onMouseUp = () => setIsDragging(false);

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};
	}, [isDragging, size.width, size.height]);

	return {
		isExpanded,
		setIsExpanded,
		position,
		size,
		isDragging,
		containerRef,
		onMouseDown,
	};
}
