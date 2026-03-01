import * as acp from "@agentclientprotocol/sdk";

import type {
	MessageContent,
	PermissionOption,
} from "../../domain/models/chat-message";
import type { SessionUpdate } from "../../domain/models/session-update";
import { AcpTypeConverter } from "./acp-type-converter";
import type { Logger } from "../../shared/logger";

export interface PendingPermissionRequest {
	resolve: (response: acp.RequestPermissionResponse) => void;
	toolCallId: string;
	options: PermissionOption[];
}

export interface PendingPermissionQueueItem {
	requestId: string;
	toolCallId: string;
	options: PermissionOption[];
}

export interface PermissionQueueState {
	pendingPermissionRequests: Map<string, PendingPermissionRequest>;
	pendingPermissionQueue: PendingPermissionQueueItem[];
}

function removeQueueItemByRequestId(
	queue: PendingPermissionQueueItem[],
	requestId: string,
): void {
	const index = queue.findIndex((entry) => entry.requestId === requestId);
	if (index >= 0) {
		queue.splice(index, 1);
	}
}

export function activateNextPermissionOperation(args: {
	state: PermissionQueueState;
	updateMessage: (toolCallId: string, content: MessageContent) => void;
}): void {
	const { state, updateMessage } = args;
	if (state.pendingPermissionQueue.length === 0) {
		return;
	}

	const next = state.pendingPermissionQueue[0];
	const pending = state.pendingPermissionRequests.get(next.requestId);
	if (!pending) {
		return;
	}

	updateMessage(next.toolCallId, {
		type: "tool_call",
		toolCallId: next.toolCallId,
		permissionRequest: {
			requestId: next.requestId,
			options: pending.options,
			isActive: true,
		},
	} as MessageContent);
}

export function handlePermissionResponseOperation(args: {
	state: PermissionQueueState;
	requestId: string;
	optionId: string;
	updateMessage: (toolCallId: string, content: MessageContent) => void;
}): void {
	const { state, requestId, optionId, updateMessage } = args;
	const request = state.pendingPermissionRequests.get(requestId);
	if (!request) {
		return;
	}

	const { resolve, toolCallId, options } = request;
	updateMessage(toolCallId, {
		type: "tool_call",
		toolCallId,
		permissionRequest: {
			requestId,
			options,
			selectedOptionId: optionId,
			isActive: false,
		},
	} as MessageContent);

	resolve({
		outcome: {
			outcome: "selected",
			optionId,
		},
	});
	state.pendingPermissionRequests.delete(requestId);
	removeQueueItemByRequestId(state.pendingPermissionQueue, requestId);
	activateNextPermissionOperation({ state, updateMessage });
}

export function cancelPendingPermissionRequestsOperation(args: {
	state: PermissionQueueState;
	logger: Logger;
	updateMessage: (toolCallId: string, content: MessageContent) => void;
}): void {
	const { state, logger, updateMessage } = args;
	logger.log(
		`[AcpAdapter] Cancelling ${state.pendingPermissionRequests.size} pending permission requests`,
	);

	state.pendingPermissionRequests.forEach(
		({ resolve, toolCallId, options }, requestId) => {
			updateMessage(toolCallId, {
				type: "tool_call",
				toolCallId,
				status: "completed",
				permissionRequest: {
					requestId,
					options,
					isCancelled: true,
					isActive: false,
				},
			} as MessageContent);

			resolve({
				outcome: {
					outcome: "cancelled",
				},
			});
		},
	);

	state.pendingPermissionRequests.clear();
	state.pendingPermissionQueue.length = 0;
}

export async function requestPermissionOperation(args: {
	params: acp.RequestPermissionRequest;
	logger: Logger;
	autoAllowPermissions: boolean;
	state: PermissionQueueState;
	updateMessage: (toolCallId: string, content: MessageContent) => void;
	sessionUpdateCallback: ((update: SessionUpdate) => void) | null;
}): Promise<acp.RequestPermissionResponse> {
	const { params, logger, autoAllowPermissions, state, sessionUpdateCallback } =
		args;

	logger.log("[AcpAdapter] Permission request received:", params);
	if (autoAllowPermissions) {
		const allowOption =
			params.options.find(
				(option) =>
					option.kind === "allow_once" ||
					option.kind === "allow_always" ||
					(!option.kind && option.name.toLowerCase().includes("allow")),
			) || params.options[0];

		logger.log("[AcpAdapter] Auto-allowing permission request:", allowOption);
		return {
			outcome: {
				outcome: "selected",
				optionId: allowOption.optionId,
			},
		};
	}

	const requestId = crypto.randomUUID();
	const toolCallId = params.toolCall?.toolCallId || crypto.randomUUID();
	const sessionId = params.sessionId;
	const normalizedOptions: PermissionOption[] = params.options.map((option) => {
		const normalizedKind =
			option.kind === "reject_always" ? "reject_once" : option.kind;
		const kind: PermissionOption["kind"] = normalizedKind
			? normalizedKind
			: option.name.toLowerCase().includes("allow")
				? "allow_once"
				: "reject_once";

		return {
			optionId: option.optionId,
			name: option.name,
			kind,
		};
	});

	const isFirstRequest = state.pendingPermissionQueue.length === 0;
	const permissionRequestData = {
		requestId,
		options: normalizedOptions,
		isActive: isFirstRequest,
	};

	state.pendingPermissionQueue.push({
		requestId,
		toolCallId,
		options: normalizedOptions,
	});

	const toolCallInfo = params.toolCall;
	sessionUpdateCallback?.({
		type: "tool_call",
		sessionId,
		toolCallId,
		title: toolCallInfo?.title ?? undefined,
		status: toolCallInfo?.status || "pending",
		kind: (toolCallInfo?.kind as acp.ToolKind | undefined) ?? undefined,
		content: AcpTypeConverter.toToolCallContent(
			toolCallInfo?.content as acp.ToolCallContent[] | undefined,
		),
		rawInput: toolCallInfo?.rawInput as { [k: string]: unknown } | undefined,
		permissionRequest: permissionRequestData,
	});

	return await new Promise((resolve) => {
		state.pendingPermissionRequests.set(requestId, {
			resolve,
			toolCallId,
			options: normalizedOptions,
		});
	});
}
