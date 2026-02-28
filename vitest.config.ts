import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			obsidian: resolve(__dirname, "test/mocks/obsidian.ts"),
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./test/setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: [
				"src/hooks/state/**/*.ts",
				"src/adapters/acp/update-routing.ts",
				"src/adapters/acp/error-diagnostics.ts",
				"src/shared/settings-schema.ts",
			],
			exclude: ["docs/**", "main.js", "node_modules/**", "src/main.ts"],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 70,
				statements: 80,
			},
		},
	},
});
