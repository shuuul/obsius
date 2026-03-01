import * as React from "react";

import type {
	SessionModeState,
	SessionModelState,
} from "../../../domain/models/chat-session";
import { SelectorButton, type SelectorOption } from "./SelectorButton";
import { getModeIcon, parseModelDisplay } from "./mode-icons";
import { ProviderLogo } from "./ProviderLogo";

export type SendButtonState = "sending" | "ready" | "disabled";

interface InputActionsProps {
	modes?: SessionModeState;
	models?: SessionModelState;
	onModeChange?: (modeId: string) => void;
	onModelChange?: (modelId: string) => void;
	sendButtonRef: React.RefObject<HTMLButtonElement | null>;
	sendButtonState: SendButtonState;
	isButtonDisabled: boolean;
	buttonTitle: string;
	onSendOrStop: () => void;
}

export function InputActions({
	modes,
	models,
	onModeChange,
	onModelChange,
	sendButtonRef,
	sendButtonState,
	isButtonDisabled,
	buttonTitle,
	onSendOrStop,
}: InputActionsProps) {
	const modeOptions: SelectorOption[] | undefined = modes?.availableModes.map(
		(mode, index) => ({
			id: mode.id,
			label: mode.name,
			description: mode.description,
			icon: getModeIcon(mode.id, index),
		}),
	);

	const modelOptions: SelectorOption[] | undefined =
		models?.availableModels.map((model) => {
			const parsed = parseModelDisplay(model.modelId, model.name);
			return {
				id: model.modelId,
				label: parsed.modelName,
				description: model.description,
				iconElement: parsed.providerSlug ? (
					<ProviderLogo slug={parsed.providerSlug} />
				) : undefined,
				icon: parsed.providerSlug ? undefined : parsed.fallbackIcon,
			};
		});

	const showModes =
		modeOptions && modeOptions.length > 1 && modes && onModeChange;
	const showModels =
		modelOptions && modelOptions.length > 1 && models && onModelChange;

	return (
		<div className="obsius-chat-input-actions">
			{(showModes || showModels) && (
				<div className="obsius-input-actions-left">
					{showModes && (
						<SelectorButton
							options={modeOptions}
							currentValue={modes.currentModeId}
							onChange={onModeChange}
							className="obsius-mode-selector"
							title={
								modes.availableModes.find((m) => m.id === modes.currentModeId)
									?.description ?? "Select mode"
							}
						/>
					)}
					{showModels && (
						<SelectorButton
							options={modelOptions}
							currentValue={models.currentModelId}
							onChange={onModelChange}
							className="obsius-model-selector"
							title={
								models.availableModels.find(
									(m) => m.modelId === models.currentModelId,
								)?.description ?? "Select model"
							}
						/>
					)}
				</div>
			)}

			<button
				ref={sendButtonRef}
				onClick={onSendOrStop}
				disabled={isButtonDisabled}
				className={`obsius-chat-send-button obsius-send-${sendButtonState}`}
				title={buttonTitle}
			></button>
		</div>
	);
}
