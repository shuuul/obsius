import { describe, expect, it } from "vitest";
import { computeInlineDiffSegments } from "../src/shared/word-diff";

describe("computeInlineDiffSegments", () => {
	it("returns empty for identical texts", () => {
		const segments = computeInlineDiffSegments("hello world", "hello world");
		expect(segments).toEqual([]);
	});

	it("detects added word", () => {
		const segments = computeInlineDiffSegments(
			"hello world",
			"hello brave world",
		);
		expect(segments.length).toBeGreaterThan(0);
		const added = segments.filter((s) => s.type === "added");
		expect(added.length).toBeGreaterThan(0);
		const addedText = added
			.map((s) => "hello brave world".slice(s.from, s.to))
			.join("");
		expect(addedText).toContain("brave");
	});

	it("detects deleted word", () => {
		const segments = computeInlineDiffSegments(
			"hello brave world",
			"hello world",
		);
		const deleted = segments.filter((s) => s.type === "deleted");
		expect(deleted.length).toBeGreaterThan(0);
		expect(deleted.some((s) => s.deletedText?.includes("brave"))).toBe(true);
	});

	it("deleted segments have from === to (zero-width)", () => {
		const segments = computeInlineDiffSegments("foo bar baz", "foo baz");
		const deleted = segments.filter((s) => s.type === "deleted");
		for (const seg of deleted) {
			expect(seg.from).toBe(seg.to);
		}
	});

	it("added segments span the correct range in current text", () => {
		const original = "the cat sat";
		const current = "the big cat sat";
		const segments = computeInlineDiffSegments(original, current);
		const added = segments.filter((s) => s.type === "added");
		for (const seg of added) {
			expect(seg.to).toBeGreaterThan(seg.from);
			const slice = current.slice(seg.from, seg.to);
			expect(slice.length).toBeGreaterThan(0);
		}
	});

	it("handles completely new text", () => {
		const segments = computeInlineDiffSegments("", "new content");
		const added = segments.filter((s) => s.type === "added");
		expect(added.length).toBeGreaterThan(0);
		const total = added.reduce((sum, s) => sum + (s.to - s.from), 0);
		expect(total).toBe("new content".length);
	});

	it("handles completely deleted text", () => {
		const segments = computeInlineDiffSegments("old content", "");
		const deleted = segments.filter((s) => s.type === "deleted");
		expect(deleted.length).toBeGreaterThan(0);
		expect(deleted.every((s) => s.from === 0 && s.to === 0)).toBe(true);
	});

	it("positions are monotonically non-decreasing", () => {
		const segments = computeInlineDiffSegments(
			"alpha beta gamma delta",
			"alpha BETA gamma DELTA epsilon",
		);
		for (let i = 1; i < segments.length; i++) {
			expect(segments[i].from).toBeGreaterThanOrEqual(segments[i - 1].from);
		}
	});

	it("handles mixed additions and deletions", () => {
		const original = "function foo() { return 1; }";
		const current = "function bar() { return 2; }";
		const segments = computeInlineDiffSegments(original, current);
		const added = segments.filter((s) => s.type === "added");
		const deleted = segments.filter((s) => s.type === "deleted");
		expect(added.length).toBeGreaterThan(0);
		expect(deleted.length).toBeGreaterThan(0);
	});
});
