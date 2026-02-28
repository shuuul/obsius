<h1 align="center">Obsius — AI Agents in Obsidian</h1>

<p align="center">

Bring AI agents (Claude Code, OpenCode, Codex, Gemini CLI) directly into Obsidian. Chat with your AI assistant right from your vault.

Built on [Agent Client Protocol (ACP)](https://github.com/zed-industries/agent-client-protocol) by Zed.

</p>

## Installation

### Via BRAT (Recommended)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Go to **Settings → BRAT → Add Beta Plugin**
3. Paste: `https://github.com/shuuul/obsius`
4. Enable **Obsius** from the plugin list

### Manual Installation

1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/shuuul/obsius/releases)
2. Place them in `VaultFolder/.obsidian/plugins/obsius/`
3. Enable the plugin in **Settings → Community Plugins**

### Setup Guides

- [OpenCode](https://shuuul.github.io/obsius/agent-setup/opencode.html)
- [Claude Code](https://shuuul.github.io/obsius/agent-setup/claude-code.html)
- [Codex](https://shuuul.github.io/obsius/agent-setup/codex.html)
- [Gemini CLI](https://shuuul.github.io/obsius/agent-setup/gemini-cli.html)
- [Custom Agents](https://shuuul.github.io/obsius/agent-setup/custom-agents.html) (Qwen Code, Kiro, Mistral Vibe, etc.)

**[Full Documentation](https://shuuul.github.io/obsius/)**

## Requirements

- Obsidian `1.5.0` or later
- Node.js `20.19.0` or later (development)

## Development

```bash
npm install
npm run dev
```

For production builds:
```bash
npm run build
```

Quality checks:
```bash
npm run typecheck
npm run lint
npm run test
```

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
