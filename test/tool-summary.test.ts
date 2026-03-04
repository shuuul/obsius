import { describe, expect, it } from "vitest";
import { extractToolFilePath } from "../src/shared/tool-file-path";
import { getToolSummary } from "../src/shared/tool-summary";

describe("extractToolFilePath", () => {
	it("extracts path from nested input payload", () => {
		const path = extractToolFilePath({
			input: {
				filePath: "/vault/notes/white-paper.md",
			},
		});

		expect(path).toBe("/vault/notes/white-paper.md");
	});

	it("extracts first path from paths array", () => {
		const path = extractToolFilePath({
			paths: ["notes/a.md", "notes/b.md"],
		});

		expect(path).toBe("notes/a.md");
	});
});

describe("getToolSummary", () => {
	it("shows vault-relative file path for read tools", () => {
		const summary = getToolSummary(
			"Read",
			"read",
			{
				input: {
					file_path: "/vault/notes/white-paper.md",
				},
			},
			undefined,
			"/vault",
		);

		expect(summary).toBe("notes/white-paper.md");
	});
});
