import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

function readDotEnv() {
	const envPath = join(ROOT, ".env");
	if (!existsSync(envPath)) {
		return {};
	}

	const parsed = {};
	const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmed.indexOf("=");
		if (separatorIndex <= 0) {
			throw new Error(`Invalid .env line: ${line}`);
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		let value = trimmed.slice(separatorIndex + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		parsed[key] = value;
	}
	return parsed;
}

function getConfig() {
	const fileEnv = readDotEnv();
	const env = { ...fileEnv, ...process.env };
	const vaultPath = env.OBSIDIAN_VAULT_PATH;
	if (!vaultPath) {
		throw new Error(
			"Missing OBSIDIAN_VAULT_PATH. Copy .env.example to .env and set the vault path.",
		);
	}

	const manifest = JSON.parse(
		readFileSync(join(ROOT, "manifest.json"), "utf8"),
	);
	const pluginId = env.OBSIDIAN_PLUGIN_ID || manifest.id;
	if (!pluginId) {
		throw new Error("Missing OBSIDIAN_PLUGIN_ID and manifest.json id.");
	}

	return {
		vaultPath,
		pluginId,
		cliVault: env.OBSIDIAN_CLI_VAULT || "",
		reloadWaitMs: Number.parseInt(env.OBSIDIAN_RELOAD_WAIT_MS || "2000", 10),
	};
}

function pluginDir(config) {
	return join(config.vaultPath, ".obsidian", "plugins", config.pluginId);
}

function enablePlugin(config) {
	const pluginsPath = join(
		config.vaultPath,
		".obsidian",
		"community-plugins.json",
	);
	let enabledPlugins = [];
	if (existsSync(pluginsPath)) {
		const parsed = JSON.parse(readFileSync(pluginsPath, "utf8"));
		if (!Array.isArray(parsed)) {
			throw new Error(`${pluginsPath} must contain a JSON array.`);
		}
		enabledPlugins = parsed;
	}

	if (!enabledPlugins.includes(config.pluginId)) {
		enabledPlugins.push(config.pluginId);
		if (existsSync(pluginsPath)) {
			const backupPath = `${pluginsPath}.backup-before-${config.pluginId}`;
			if (!existsSync(backupPath)) {
				copyFileSync(pluginsPath, backupPath);
			}
		}
		writeJson(pluginsPath, enabledPlugins);
		console.log(`Enabled ${config.pluginId} in ${pluginsPath}`);
	}
}

function writeJson(path, value) {
	const json = `${JSON.stringify(value, null, 2)}\n`;
	writeFileSync(path, json);
}

function deploy() {
	const config = getConfig();
	const targetDir = pluginDir(config);
	mkdirSync(targetDir, { recursive: true });

	for (const fileName of REQUIRED_ARTIFACTS) {
		const source = join(ROOT, fileName);
		if (!existsSync(source)) {
			throw new Error(
				`Missing ${fileName}. Run npm run build before deploy:base.`,
			);
		}
		copyFileSync(source, join(targetDir, fileName));
	}

	enablePlugin(config);
	console.log(`Deployed ${config.pluginId} to ${targetDir}`);
}

function runObsidian(args, cwd) {
	const result = spawnSync("obsidian", args, {
		cwd,
		stdio: "inherit",
	});
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function readObsidian(args, cwd) {
	const result = spawnSync("obsidian", args, {
		cwd,
		encoding: "utf8",
	});
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		if (result.stderr) {
			process.stderr.write(result.stderr);
		}
		process.exit(result.status ?? 1);
	}
	return {
		stdout: result.stdout || "",
		stderr: result.stderr || "",
	};
}

function sleep(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withVaultArg(args, cliVault) {
	if (!cliVault) {
		return args;
	}
	return [...args, `--vault=${cliVault}`];
}

function reload() {
	const config = getConfig();
	runObsidian(
		withVaultArg(["command", "id=app:reload"], config.cliVault),
		config.vaultPath,
	);
	if (config.reloadWaitMs > 0) {
		sleep(config.reloadWaitMs);
	}
}

function verify() {
	const config = getConfig();
	const args = withVaultArg(
		["commands", `filter=${config.pluginId}`],
		config.cliVault,
	);
	const maxAttempts = 10;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const result = readObsidian(args, config.vaultPath);
		if (result.stdout.trim()) {
			process.stdout.write(result.stdout);
			if (result.stderr) {
				process.stderr.write(result.stderr);
			}
			return;
		}
		if (attempt < maxAttempts) {
			sleep(500);
		}
	}
	throw new Error(
		`No Obsidian commands found for ${config.pluginId}. Confirm the plugin is enabled and Obsidian finished reloading.`,
	);
}

const action = process.argv[2];
try {
	if (action === "deploy") {
		deploy();
	} else if (action === "reload") {
		reload();
	} else if (action === "verify") {
		verify();
	} else {
		throw new Error(
			"Usage: node scripts/obsidian-dev.mjs <deploy|reload|verify>",
		);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
