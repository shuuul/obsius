import { describe, expect, it } from "vitest";
import {
	computeAnchoredInlineDiffSegments,
	computeInlineDiffSegments,
} from "../src/shared/word-diff";

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

	it("limits added header numbering to changed header blocks", () => {
		const original = [
			"# PKM 与 CKM 核心概念总结",
			"",
			"## 什么是 PKM 和 CKM?",
			"",
			"## PKM：个人知识管理",
			"",
			"核心流程：",
			"1. 捕获",
			"2. 组织",
			"3. 提炼与综合",
			"4. 表达与应用",
			"",
			"关键特征：",
			"一 主体：个体导向",
			"二 目标：提升个人认知效率、创造力",
			"",
			"## CKM：协同/企业知识管理",
			"",
			"## 辩证关系",
		].join("\n");
		const current = [
			"# 1. PKM 与 CKM 核心概念总结",
			"",
			"## 2. 什么是 PKM 和 CKM?",
			"",
			"## 3. PKM：个人知识管理",
			"",
			"核心流程：",
			"1. 捕获",
			"2. 组织",
			"3. 提炼与综合",
			"4. 表达与应用",
			"",
			"关键特征：",
			"一 主体：个体导向",
			"二 目标：提升个人认知效率、创造力",
			"",
			"## 4. CKM：协同/企业知识管理",
			"",
			"## 5. 辩证关系",
		].join("\n");

		const segments = computeInlineDiffSegments(original, current);
		const addedTexts = segments
			.filter((segment) => segment.type === "added")
			.map((segment) => current.slice(segment.from, segment.to));

		expect(addedTexts).toEqual(["1. ", "2. ", "3. ", "4. ", "5. "]);
	});

	it("limits removed header numbering to changed header blocks", () => {
		const original = [
			"# 1. PKM 与 CKM 核心概念总结",
			"",
			"## 2. 什么是 PKM 和 CKM?",
			"",
			"## 3. PKM：个人知识管理",
			"",
			"核心流程：",
			"1. 捕获",
			"2. 组织",
			"3. 提炼与综合",
			"4. 表达与应用",
			"",
			"关键特征：",
			"一 主体：个体导向",
			"二 目标：提升个人认知效率、创造力",
			"",
			"## 4. CKM：协同/企业知识管理",
			"",
			"## 5. 辩证关系",
		].join("\n");
		const current = [
			"# PKM 与 CKM 核心概念总结",
			"",
			"## 什么是 PKM 和 CKM?",
			"",
			"## PKM：个人知识管理",
			"",
			"核心流程：",
			"1. 捕获",
			"2. 组织",
			"3. 提炼与综合",
			"4. 表达与应用",
			"",
			"关键特征：",
			"一 主体：个体导向",
			"二 目标：提升个人认知效率、创造力",
			"",
			"## CKM：协同/企业知识管理",
			"",
			"## 辩证关系",
		].join("\n");

		const segments = computeInlineDiffSegments(original, current);
		const deletedTexts = segments
			.filter((segment) => segment.type === "deleted")
			.map((segment) => segment.deletedText);

		expect(deletedTexts).toEqual(["1. ", "2. ", "3. ", "4. ", "5. "]);
	});

	it("anchors snippet diffs to the matching block in the full document", () => {
		const originalDocument = [
			"# PKM 与 CKM 核心概念总结",
			"",
			"## 什么是 PKM 和 CKM?",
			"",
			"## PKM：个人知识管理",
			"",
			"核心流程：",
			"1. 捕获",
			"2. 组织",
			"3. 提炼与综合",
			"4. 表达与应用",
			"",
			"## CKM：协同/企业知识管理",
			"",
			"## 辩证关系",
		].join("\n");
		const currentDocument = [
			"# PKM 与 CKM 核心概念总结",
			"",
			"## 1. 什么是 PKM 和 CKM?",
			"",
			"## 2. PKM：个人知识管理",
			"",
			"核心流程：",
			"1. 捕获",
			"2. 组织",
			"3. 提炼与综合",
			"4. 表达与应用",
			"",
			"## CKM：协同/企业知识管理",
			"",
			"## 辩证关系",
		].join("\n");
		const originalSnippet = "## 什么是 PKM 和 CKM?\n\n## PKM：个人知识管理";
		const currentSnippet =
			"## 1. 什么是 PKM 和 CKM?\n\n## 2. PKM：个人知识管理";

		const segments = computeAnchoredInlineDiffSegments(
			currentDocument,
			originalSnippet,
			currentSnippet,
		);

		expect(segments).not.toBeNull();
		const addedTexts = (segments ?? [])
			.filter((segment) => segment.type === "added")
			.map((segment) => currentDocument.slice(segment.from, segment.to));
		expect(addedTexts).toEqual(["1. ", "2. "]);
		expect(
			addedTexts.every(
				(text) =>
					text !== "1. 捕获" &&
					text !== "2. 组织" &&
					text !== "3. 提炼与综合" &&
					text !== "4. 表达与应用",
			),
		).toBe(true);
		expect(originalDocument.includes(originalSnippet)).toBe(true);
	});

	it("returns null when snippet current text is not present in the full document", () => {
		const documentText = [
			"# Title",
			"",
			"## Section A",
			"",
			"## Section B",
		].join("\n");
		const originalSnippet = "## Section A";
		const currentSnippet = "## 1. Section A";

		const segments = computeAnchoredInlineDiffSegments(
			documentText,
			originalSnippet,
			currentSnippet,
		);

		expect(segments).toBeNull();
	});
});
