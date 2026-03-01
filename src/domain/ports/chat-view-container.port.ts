/**
 * Port for chat view containers
 *
 * This interface defines the contract for all chat view implementations
 * (sidebar, future code-block). It enables unified view management
 * for features like focus tracking, broadcast commands, and multi-view operations.
 *
 * Design notes:
 * - viewId is unique across all view types
 * - viewType enables type-specific filtering
 * - Lifecycle methods (onActivate/onDeactivate) are called by ChatViewRegistry
 * - Broadcast methods mirror ChatView's existing registerInputCallbacks interface
 */

import type { ChatInputState } from "../models/chat-input-state";

export interface ChatViewContextReference {
	type: "selection" | "file" | "folder";
	notePath: string;
	noteName: string;
	selection?: {
		from: { line: number; ch: number };
		to: { line: number; ch: number };
	};
}

/**
 * Type of chat view container.
 * Used for filtering and type-specific behavior.
 */
export type ChatViewType = "sidebar";

/**
 * Interface that all chat view containers must implement.
 * Enables the plugin to manage views uniformly regardless of their implementation.
 */
export interface IChatViewContainer {
	/** Unique identifier for this view instance */
	readonly viewId: string;

	/** Type of this view */
	readonly viewType: ChatViewType;

	/** Human-readable display name for this view (e.g. active agent label). */
	getDisplayName(): string;

	/**
	 * Called when this view becomes the active/focused view.
	 * Triggered by ChatViewRegistry.setFocused().
	 */
	onActivate(): void;

	/**
	 * Called when this view loses active/focused status.
	 * Triggered by ChatViewRegistry.setFocused() or unregister().
	 */
	onDeactivate(): void;

	/**
	 * Programmatically focus this view's input.
	 * Should focus the chat input textarea.
	 */
	focus(): void;

	/**
	 * Check if this view currently has focus.
	 * Returns true if any element within this view's container is focused.
	 */
	hasFocus(): boolean;

	/** Expand the view if it's in a collapsed state. No-op for sidebar views. */
	expand(): void;

	/** Collapse the view if it's in an expanded state. No-op for sidebar views. */
	collapse(): void;

	/**
	 * Get current input state (text + images) for broadcast.
	 * Returns null if input state is not available.
	 */
	getInputState(): ChatInputState | null;

	/**
	 * Set input state (text + images) from broadcast.
	 * Used to copy prompt from one view to another.
	 */
	setInputState(state: ChatInputState): void;

	/**
	 * Append a structured context reference to input text atomically.
	 * Returns false when the same reference already exists.
	 */
	addContextReference(reference: ChatViewContextReference): boolean;

	/**
	 * Check if this view is ready to send a message.
	 */
	canSend(): boolean;

	/**
	 * Trigger send message with full support for images.
	 * @returns Promise<boolean> - true if message was sent, false otherwise
	 */
	sendMessage(): Promise<boolean>;

	/**
	 * Cancel current operation.
	 * Stops ongoing message generation.
	 */
	cancelOperation(): Promise<void>;

	/**
	 * Get the DOM container element for this view.
	 * Used for focus detection and DOM queries.
	 */
	getContainerEl(): HTMLElement;
}
