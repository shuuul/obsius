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
	const parts = Diff.diffWords(originalText, currentText);
	const segments: InlineDiffSegment[] = [];
	let pos = 0;

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

	return segments;
}
