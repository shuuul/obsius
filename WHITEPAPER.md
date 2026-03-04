# Obsius White Paper

This weekend, I spent some time building my Obsidian plugin [Obsius](https://github.com/shuuul/obsius) with the help of various coding AI agents. The problem it addresses is not how to write code. It is how to co-write with AI.

## Writing and Programming

Whether you write code or prose, context management is the central challenge. Programming has dependency graphs; writing has argument networks and narrative tension — I use Heptabase's whiteboard to visualize the latter. The two are comparable in complexity, but the critical differences lie elsewhere.

Natural language lacks the precision of a programming language. Renaming a variable is a deterministic operation — the semantics are unambiguous. But swap a single word in a sentence and you can shift the style, the rhythm, even the meaning of an entire passage. Programming strives for logical correctness. Writing strives for a different kind of precision — aesthetic precision, the kind that lives at the level of individual words and phrases.

And then there is the question of delivery.

Code iterates after release. You ship v1, collect feedback, fix bugs in v2, optimize in v3. Each version is the product of ongoing interaction with users and AI. Writing does not work this way. What you hand the reader is almost always the final version. No one reads v1, v2, v3 of your essay. They see only the finished piece.

This means the writer must try different words, different expressions, different structural arrangements — polishing, discarding, polishing again — all before anyone reads a single line. The iteration of writing is compressed entirely into the period before delivery.

This changes everything about how AI fits in.

Code iteration can be outsourced to processes — CI/CD, automated testing, user feedback loops — and embedding AI is just adding another node. But the iterations of writing — every "should I swap this word," every "does this sentence's rhythm feel right," every "should I cut this paragraph" — these are extensions of the writer's aesthetic will. They cannot be outsourced. Only the writer can make them.

And yet. Human context length is limited. You cannot simultaneously hold the structural tension of an entire essay, the logical chain of the current paragraph, and the rhythm of the sentence in front of you. This is why AI collaboration in writing has to be high-frequency, alternating, dialogic. You write a passage, review it, adjust it, then let AI step in for the next bit. Each iteration small enough for your cognitive bandwidth to cover.

Which means writing tools should follow a fundamentally different design logic from code editors. A code editor manages complexity: file trees, symbol indexes, global search, auto-completion. A writing tool should manage attention and iteration rhythm — giving you the highest-precision control over the text at hand, while preserving the flexibility to hand off to AI at any moment.

## The Root of "AI Flavor"

Everyone complains that AI-generated prose has an "AI flavor."

Where does it come from? On the surface: formulaic diction, templated structure, absence of personal voice. But the Principal-Agent Problem offers a sharper lens. AI flavor is the textual residue of information asymmetry between principal and agent.

When you hand AI a writing task, you enter a classic principal-agent relationship. You are the principal. AI is the agent. You hold an intent; you want it faithfully rendered in text. But today's instruct-tuned LLMs are conditional probability models: given your prompt as a condition, they generate the most likely continuation. The information density of your prompt bounds the quality of what comes back.

Here is where writing and programming diverge.

A programming language is a high-precision DSL. A single function signature carries fully determinate semantics — an extremely dense signal for AI. Natural language offers no such guarantee. As I just argued, a word swap changes style, a structural tweak changes rhythm. To get AI to produce text of the same quality you'd expect from code, you would need prompts far longer and more detailed than anything a coding context requires — enough to pin down tone, anchor style, constrain direction.

Nobody does this. Nobody writes a prompt longer than the passage they want revised.

And so a gap opens between what you meant and what AI understood. Your aesthetic judgment operates at the word level. Your prompt operates at the paragraph level. You say "write me an article about X" and receive a complete piece. Something feels off, but you cannot encode in the prompt that "the transition in the third paragraph's second sentence is too abrupt — add a causal bridge." Even if you could, the next generation pass would overwrite the lines you just tuned.

![](./assets/precise-control.png)

As I argued before, the core value of a DSL is reducing communication cost. Humans can communicate with AI through code, and programming languages compress that cost enormously through their information density. But in writing, the medium between human and AI is natural language itself — a medium without a precise control interface.

When your intent operates at nanometer precision and the prompt supplies centimeter-level constraints, the model fills every unconstrained dimension with statistical defaults. That "AI flavor" is the taste of those defaults: wherever the principal left a gap, the agent plugged it with the training-data mean.

This is why Obsius's first design principle is **word-and-sentence-level context control**. If prompts can't carry enough information density, shift the burden to the tool layer. Let the writer select a passage and tell AI: "modify only this — leave everything else untouched." Let them lock paragraphs they're satisfied with, so subsequent generations can't contaminate them. Let every edit define an extremely narrow boundary. Even with a low-density prompt, shrinking the action space achieves the same constraining effect.

## From Dialogue to Invocation

The precise control I just described focuses on the modification stage: delineating scope, locking paragraphs, shrinking boundaries. But writing has another class of needs — some operations are reusable across articles and scenarios.

Distilling a writing style. Extracting an argument structure. Codifying a summary template. These shared capabilities can absolutely be implemented through AI, provided you can trigger them precisely. If you describe them from scratch in a chat box every time, the results are unstable: different wording each time, different output each time.

Obsius supports explicitly triggering skills, commands, and MCP. You can encapsulate operations you use again and again — "rewrite this passage in a certain author's style," "restructure this paragraph according to a specific argument template," "extract the core argument structure of this article" — into nameable, reusable instructions, and trigger them precisely when needed.

![](./assets/trigger.png)

This is fundamentally different from chatting. Natural language descriptions are ambiguous and non-reproducible. Explicit commands are deterministic and reproducible. You are not *requesting* AI to do something — you are *invoking* a predefined operation.

If the word-level control from the previous section shrinks the action space, then explicit commands solidify the actions themselves. Together, they push the writing tool from a purely conversational interface toward a programmable one.

## Humans May Choose Not to Look, but AI Must Show Its Work

![](./assets/diff.png)

Obsius's second design principle: **every modification must be visible as a diff.**

This is still a corollary of the principal-agent problem. The previous section addressed how the principal expresses intent. This section addresses how the principal verifies execution.

The classic dilemma: the agent optimizes for its own objective, which need not coincide with the principal's. LLMs optimize for maximum likelihood under given conditions — not for your aesthetic preferences. They produce the statistically most "reasonable" text, not the text that feels most "right" to you. This misalignment is structural. No amount of prompt engineering eliminates it.

So the principal must retain the right of review.

You hand AI a passage. It returns a revision. If you can't see what changed, you have no way to judge whether the edit was faithful to your intent. Most AI writing plugins I've used on Obsidian modify the file in place — you see only the result, with no trace of the process. This is tantamount to abolishing oversight in a principal-agent relationship.

Cursor set the standard in coding. Every AI modification appears as an inline diff — additions, deletions, and changes rendered line by line — and you can accept one line while rejecting another. This liberates you from the binary of "accept all or reject all."

Writing needs the same thing. When AI revises a passage, you should see which words were swapped, which sentences restructured, which paragraphs rearranged.

You may choose not to look, just as you might trust a seasoned editor and accept changes sight unseen. But the premise of that trust is having the option. AI must provide this visibility. It is the principal's baseline defense of decision-making authority under structural misalignment.

## Obsidian: A Love-Hate Container

Why build on Obsidian?

It is software I have a love-hate relationship with.

I love its underlying philosophy: local files, Markdown, an open plugin ecosystem. Your data lives as `.md` files on your own disk — zero vendor lock-in. That respect for user sovereignty is rare in an era saturated with SaaS.

I hate what happens after you install a dozen plugins. The app becomes a bloated, unpredictable creature. Each plugin ships its own config, its own shortcuts, its own UI logic. They conflict. The plugin system grants the community boundless creativity at the cost of a fragmented experience.

Yet that very openness makes the Obsius experiment possible. A closed editor offers no seam through which to insert an AI collaboration layer. Obsidian's plugin architecture lets you wedge custom interaction logic between the editor and the file system. Not the most elegant platform, but the most practical proving ground for ideas like these.

Once this weekend project wraps up, I'll go back to Notion AI. Not because Notion AI has solved the interaction problems described above, but for a more prosaic reason: it lets me use the best model without hesitation — Opus 4.6. At this stage, the ceiling of model capability matters more than the tool's interaction experience.

The same logic explains why so many people now champion Claude Code. Its interaction experience is no better than Cursor's — in many dimensions, more primitive. But people flock to it because it gives access to stronger models at lower cost. When model capability is still rapidly climbing, users vote with their feet for the model, not the interface. The refined design of the tool layer is a secondary concern in the face of a generational gap in models.

But this does not mean interaction design is unimportant. It means its value will be released when model capability converges. When every tool can access models of the same caliber, precise context control and visible change tracking will shift from "nice to have" to core competitive advantage. Whether the platform is Notion, Obsidian, or anything else — as long as humans and AI co-write, these remain indispensable infrastructure.

## Closing

Writing this white paper made me realize something: writing is harder than programming.

The claim sounds counterintuitive. Programming involves complex type systems, concurrency models, distributed architectures; writing is "just" turning ideas into words. But anyone who has spent enough time in software knows the truth: typing code was never the hard part. The hard part comes before — gathering requirements, understanding scenarios, mapping a messy real world onto a precise formal system. Code is the artifact. Thinking is the work.

Writing is no different. The difficulty lies not in placing words on a page but in deciding what to say, why to say it, and in what structure and rhythm. And as I noted earlier, much of the time you don't know what you want to say until you're already writing. Ideas are generated in the act, not completed before it.

AI has undeniably made writing code easier. But will it make software development simpler? I doubt it. By the same token, AI can make generating text almost free, but it won't make writing simpler. The core difficulty is not generation — it is judgment. Knowing what to keep and what to cut. Sensing whether an analogy is precise or lazy. Feeling whether a paragraph's cadence matches the tension of the whole piece. These judgments rest on aesthetic intuition, accumulated experience, and an awareness of the reader — precisely what conditional probability models handle least well.

Could we train a model that writes at an extraordinary level and adapts to any style? Surely. But would it be worth it? The ultimate value of writing is not the text itself but the thinking behind it. An essay matters not only for what the reader sees but for what the author figured out in the process. If the model does the thinking for you, you gain an essay and lose an occasion to think.

Obsius is a rough, weekend-project-level answer. But the question itself deserves to be taken seriously.

## Acknowledgments

Obsius is forked from [obsidian-agent-client](https://github.com/RAIT-09/obsidian-agent-client). Despite extensive rewriting, the core architecture still stands on its foundation. obsidian-agent-client demonstrated something important: through [Agent Client Protocol (ACP)](https://github.com/zed-instances/agent-client-protocol), Obsidian can connect to any agent. This protocol, proposed by Zed, defines the communication interface between editors and AI agents, fully decoupling the tool layer from the model layer.

But I have a personal agenda: writing deserves a dedicated agent. Not a general-purpose agent that can do anything, but one written in Rust, with limited tools, designed specifically for writing. It only needs to do a few things: precisely select text, generate diffs, execute predefined writing instructions, and connect to the corresponding writing software via API. The tighter the constraints, the more controllable the output. This is consistent with the core thesis of this paper: AI collaboration in writing doesn't need unlimited capability — it needs limited and precise control.

Thanks also to [Notion](https://www.notion.so), [Claudian](https://github.com/YishenTu/claudian), and [Cursor](https://cursor.com) for inspiration in interaction design, and to [@lobehub/icons](https://github.com/lobehub/lobe-icons) for providing AI brand icons.

_Mar 4, 2026_

shuuul
