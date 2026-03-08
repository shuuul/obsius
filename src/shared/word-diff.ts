import * as Diff from "diff";

export interface InlineDiffSegment {
	type: "added" | "deleted";
	/** Character offset in the current (new) text */
	from: number;
	/** For added: from + length. For deleted: same as from (zero-width insertion point). */
	to: number;
	/** The removed text, present only for deleted segments */
	deletedText?: string;
}

export interface InlineDiffOptions {
	mode?: "document" | "snippet";
}

/**
 * Compute word-level diff segments mapped to character positions in `currentText`.
 *
 * Added segments mark ranges that exist in currentText but not in originalText.
 * Deleted segments are zero-width points in currentText where originalText had content.
 */
export function computeInlineDiffSegments(
	originalText: string,
	currentText: string,
): InlineDiffSegment[] {
	const lineParts = Diff.diffLines(originalText, currentText);
	const segments: InlineDiffSegment[] = [];
	let pos = 0;

	for (let i = 0; i < lineParts.length; i++) {
		const part = lineParts[i];
		const next = lineParts[i + 1];

		if (part.added && next?.removed) {
			appendWordDiffSegments(next.value, part.value, pos, segments);
			pos += part.value.length;
			i++;
			continue;
		}

		if (part.removed && next?.added) {
			appendWordDiffSegments(part.value, next.value, pos, segments);
			pos += next.value.length;
			i++;
			continue;
		}

		if (part.added) {
			segments.push({
				type: "added",
				from: pos,
				to: pos + part.value.length,
			});
			pos += part.value.length;
			continue;
		}

		if (part.removed) {
			segments.push({
				type: "deleted",
				from: pos,
				to: pos,
				deletedText: part.value,
			});
			continue;
		}

		pos += part.value.length;
	}

	return segments;
}

export function computeAnchoredInlineDiffSegments(
	documentText: string,
	originalText: string,
	currentText: string,
): InlineDiffSegment[] | null {
	const anchor = documentText.indexOf(currentText);
	if (anchor === -1) {
		return null;
	}

	return computeInlineDiffSegments(originalText, currentText).map((segment) => ({
		...segment,
		from: segment.from + anchor,
		to: segment.to + anchor,
	}));
}

function appendWordDiffSegments(
	originalText: string,
	currentText: string,
	offset: number,
	segments: InlineDiffSegment[],
): void {
	const parts = Diff.diffWords(originalText, currentText);
	let pos = offset;

	for (const part of parts) {
		if (part.added) {
			segments.push({
				type: "added",
				from: pos,
				to: pos + part.value.length,
			});
			pos += part.value.length;
		} else if (part.removed) {
			segments.push({
				type: "deleted",
				from: pos,
				to: pos,
				deletedText: part.value,
			});
		} else {
			pos += part.value.length;
		}
	}
}
