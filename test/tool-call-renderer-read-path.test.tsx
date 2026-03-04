import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolCallRenderer } from "../src/components/chat/ToolCallRenderer";

vi.mock("../src/components/chat/ObsidianIcon", () => ({
	ObsidianIcon: ({
		name,
		className,
	}: {
		name: string;
		className?: string;
		size?: number;
	}) => <span data-icon={name} className={className} aria-hidden="true" />,
}));

const mockPlugin = {
	app: {
		vault: {
			adapter: {},
		},
		workspace: {
			getLeavesOfType: () => [],
			setActiveLeaf: () => undefined,
			openLinkText: () => Promise.resolve(),
		},
	},
	settings: {
		displaySettings: {
			autoCollapseDiffs: false,
			diffCollapseThreshold: 10,
		},
	},
} as unknown as Parameters<typeof ToolCallRenderer>[0]["plugin"];

describe("ToolCallRenderer read file label", () => {
	it("shows extracted file path for nested read input", () => {
		render(
			<ToolCallRenderer
				content={{
					type: "tool_call",
					toolCallId: "read-1",
					title: "read",
					kind: "read",
					status: "in_progress",
					rawInput: {
						input: {
							filePath: "notes/white-paper.md",
						},
					},
				}}
				plugin={mockPlugin}
			/>,
		);

		expect(screen.getByText("Read")).toBeTruthy();
		expect(screen.getByText("notes/white-paper.md")).toBeTruthy();
	});
});
