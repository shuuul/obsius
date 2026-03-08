import { Modal, type App, Notice } from "obsidian";
import type AgentClientPlugin from "../plugin";

class InlineEditPromptModal extends Modal {
	constructor(
		app: App,
		private onSubmit: (instruction: string) => void,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("obsius-inline-edit-prompt");

		contentEl.createEl("h3", { text: "AI edit instruction" });

		const input = contentEl.createEl("textarea", {
			placeholder: "Describe how to edit the selected text...",
		});
		input.addClass("obsius-inline-edit-textarea");
		input.rows = 3;
		input.focus();

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				const value = input.value.trim();
				if (value) {
					this.onSubmit(value);
					this.close();
				}
			}
		});

		const footer = contentEl.createDiv("obsius-inline-edit-footer");
		const submitBtn = footer.createEl("button", { text: "Submit" });
		submitBtn.addClass("mod-cta");
		submitBtn.addEventListener("click", () => {
			const value = input.value.trim();
			if (value) {
				this.onSubmit(value);
				this.close();
			}
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

export function registerInlineEditCommand(plugin: AgentClientPlugin): void {
	plugin.addCommand({
		id: "inline-ai-edit",
		name: "AI edit selection",
		editorCallback: (editor, ctx) => {
			const selection = editor.getSelection();
			if (!selection.trim()) {
				new Notice("Select text first");
				return;
			}

			const filePath = ctx.file?.path ?? "untitled";

			new InlineEditPromptModal(plugin.app, (instruction: string) => {
				const focused = plugin.viewRegistry.getFocused();
				if (!focused) {
					new Notice("No active chat view — open Obsius first");
					return;
				}

				const prompt = buildInlineEditPrompt(instruction, selection);

				focused.setInputState({ text: prompt, images: [] });

				focused
					.sendMessage()
					.then((sent) => {
						if (!sent) {
							new Notice("Failed to send to agent");
							return;
						}

						new Notice("Waiting for AI response...");

						let attempts = 0;
						const maxAttempts = 120;
						const checkInterval = setInterval(() => {
							attempts++;
							const result = focused.getLastAssistantText?.();
							if (result && attempts > 2) {
								clearInterval(checkInterval);
								const cleaned = cleanCodeFence(result);
								editor.replaceSelection(cleaned);
								new Notice("Edit applied");
								void plugin.inlineDiffManager.applyDiff(
									filePath,
									selection,
									cleaned,
									{ mode: "snippet" },
								);
							}
							if (attempts >= maxAttempts) {
								clearInterval(checkInterval);
								new Notice("AI edit timed out");
							}
						}, 500);
					})
					.catch(() => {
						new Notice("Failed to send to agent");
					});
			}).open();
		},
	});
}

function buildInlineEditPrompt(instruction: string, selection: string): string {
	return `Edit the following code according to this instruction: "${instruction}"\n\nOriginal:\n\`\`\`\n${selection}\n\`\`\`\n\nReturn ONLY the edited code, no explanation.`;
}

function cleanCodeFence(text: string): string {
	let cleaned = text.trim();
	const fenceMatch = cleaned.match(/^```\w*\n([\s\S]*?)\n```$/);
	if (fenceMatch) {
		cleaned = fenceMatch[1];
	}
	return cleaned;
}
