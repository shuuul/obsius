# OpenCode Setup

OpenCode is an AI coding agent by [Anomalyco](https://github.com/anomalyco/opencode). It natively supports ACP with first-class support in Obsius.

## Install and Configure

OpenCode is installed via npm. Open a terminal (Terminal on macOS/Linux, PowerShell on Windows) and run:

```bash
npm install -g opencode-ai
```

## Find the Installation Path

::: code-group

```bash [macOS/Linux]
which opencode-ai
# Example output: /usr/local/bin/opencode-ai
```

```cmd [Windows]
where.exe opencode-ai
# Example output: C:\Users\Username\AppData\Roaming\npm\opencode-ai.cmd
```

:::

## Configure in Obsius

1. Open **Settings → Obsius**
2. Scroll to the **OpenCode** section under **Built-in agents**
3. Set the **Path** to the path found above

::: tip
The default arguments include `acp`, which is required to enable Agent Client Protocol mode. Do not remove it.
:::

## Authentication

OpenCode authenticates via its own CLI login. Run the following command in your terminal:

```bash
opencode auth login
```

Follow the prompts to authenticate. Once logged in, Obsius will use the existing session automatically — no API key is needed.

For more details, see the [OpenCode documentation](https://opencode.ai/docs).

## Verify Setup

1. Click the robot icon in the ribbon or use the command palette: **"Open agent chat"**
2. Select **OpenCode** from the agent dropdown in the chat header
3. Try sending a message to verify the connection

Having issues? See [Troubleshooting](/help/troubleshooting).
