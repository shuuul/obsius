import * as React from "react";
import { setIcon } from "obsidian";

import type {
	SessionModeState,
	SessionModelState,
} from "../../../domain/models/chat-session";

interface InputActionsProps {
	modes?: SessionModeState;
	models?: SessionModelState;
	modeDropdownRef: React.RefObject<HTMLDivElement | null>;
	modelDropdownRef: React.RefObject<HTMLDivElement | null>;
	sendButtonRef: React.RefObject<HTMLButtonElement | null>;
	isSending: boolean;
	isButtonDisabled: boolean;
	buttonTitle: string;
	onSendOrStop: () => void;
}

export function InputActions({
	modes,
	models,
	modeDropdownRef,
	modelDropdownRef,
	sendButtonRef,
	isSending,
	isButtonDisabled,
	buttonTitle,
	onSendOrStop,
}: InputActionsProps) {
	return (
		<div className="obsius-chat-input-actions">
			{modes && modes.availableModes.length > 1 && (
				<div
					className="obsius-mode-selector"
					title={
						modes.availableModes.find((m) => m.id === modes.currentModeId)
							?.description ?? "Select mode"
					}
				>
					<div ref={modeDropdownRef} />
					<span
						className="obsius-mode-selector-icon"
						ref={(el) => {
							if (el) setIcon(el, "chevron-down");
						}}
					/>
				</div>
			)}

			{models && models.availableModels.length > 1 && (
				<div
					className="obsius-model-selector"
					title={
						models.availableModels.find(
							(m) => m.modelId === models.currentModelId,
						)?.description ?? "Select model"
					}
				>
					<div ref={modelDropdownRef} />
					<span
						className="obsius-model-selector-icon"
						ref={(el) => {
							if (el) setIcon(el, "chevron-down");
						}}
					/>
				</div>
			)}

			<button
				ref={sendButtonRef}
				onClick={onSendOrStop}
				disabled={isButtonDisabled}
				className={`obsius-chat-send-button ${isSending ? "sending" : ""} ${isButtonDisabled ? "obsius-disabled" : ""}`}
				title={buttonTitle}
			></button>
		</div>
	);
}
