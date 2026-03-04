import {
	StateField,
	StateEffect,
	type Extension,
	RangeSetBuilder,
} from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	WidgetType,
	EditorView,
} from "@codemirror/view";
import type { InlineDiffSegment } from "../../shared/word-diff";

class DeletedTextWidget extends WidgetType {
	constructor(readonly text: string) {
		super();
	}

	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = "obsius-inline-diff-deleted";
		span.textContent = this.text;
		return span;
	}

	eq(other: DeletedTextWidget): boolean {
		return this.text === other.text;
	}

	get estimatedHeight(): number {
		return -1;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

export const setInlineDiff = StateEffect.define<InlineDiffSegment[]>();
const clearInlineDiff = StateEffect.define<void>();

const inlineDiffField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},

	update(decorations, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setInlineDiff)) {
				return buildDecorations(effect.value, tr.state.doc.length);
			}
			if (effect.is(clearInlineDiff)) {
				return Decoration.none;
			}
		}
		if (tr.docChanged) {
			return Decoration.none;
		}
		return decorations;
	},

	provide(field) {
		return EditorView.decorations.from(field);
	},
});

function buildDecorations(
	segments: InlineDiffSegment[],
	docLength: number,
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	const sorted = [...segments].sort((a, b) => a.from - b.from || a.to - b.to);

	for (const seg of sorted) {
		if (seg.from > docLength) continue;

		if (seg.type === "deleted" && seg.deletedText) {
			builder.add(
				seg.from,
				seg.from,
				Decoration.widget({
					widget: new DeletedTextWidget(seg.deletedText),
					side: -1,
				}),
			);
		} else if (seg.type === "added") {
			const to = Math.min(seg.to, docLength);
			if (to > seg.from) {
				builder.add(
					seg.from,
					to,
					Decoration.mark({ class: "obsius-inline-diff-added" }),
				);
			}
		}
	}

	return builder.finish();
}

export function inlineDiffExtension(): Extension {
	return inlineDiffField;
}
