import { describe, expect, it } from "vitest";
import {
	extractStderrErrorHint,
	getSpawnErrorInfo,
} from "../src/adapters/acp/error-diagnostics";

describe("error diagnostics", () => {
	it("returns command-not-found guidance for ENOENT", () => {
		const error = Object.assign(new Error("missing"), { code: "ENOENT" });
		const info = getSpawnErrorInfo(error, "codex", "Codex");
		expect(info.title).toBe("Command not found");
		expect(info.suggestion).toContain("which");
	});

	it("returns API-key hint for missing key stderr", () => {
		expect(
			extractStderrErrorHint("LoadAPIKeyError: API key is missing"),
		).toContain("API key");
	});

	it("returns auth hint for auth stderr and null for unrelated stderr", () => {
		expect(extractStderrErrorHint("authentication failed 401")).toContain(
			"authentication",
		);
		expect(extractStderrErrorHint("random stderr")).toBeNull();
	});

	it("returns startup fallback for non-ENOENT errors", () => {
		const error = new Error("boom");
		const info = getSpawnErrorInfo(error, "foo", "Codex");
		expect(info.title).toBe("Agent startup error");
		expect(info.message).toContain("boom");
	});
});
