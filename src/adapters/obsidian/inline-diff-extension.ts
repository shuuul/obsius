import {
	type Extension,
	RangeSetBuilder,
	StateEffect,
	StateField,
} from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	WidgetType,
} from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
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

class AddedTextWidget extends WidgetType {
	constructor(readonly text: string) {
		super();
	}

	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = "obsius-inline-diff-added-widget";
		span.textContent = this.text;
		return span;
	}

	eq(other: AddedTextWidget): boolean {
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
				return buildDecorations(
					effect.value,
					tr.state.doc,
					tr.state.field(editorLivePreviewField, false) === true,
				);
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
	doc: EditorView["state"]["doc"],
	isLivePreview: boolean,
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const docLength = doc.length;

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
				if (isLivePreview) {
					builder.add(
						seg.from,
						to,
						Decoration.replace({
							widget: new AddedTextWidget(doc.sliceString(seg.from, to)),
						}),
					);
					continue;
				}

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
