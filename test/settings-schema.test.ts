import { describe, expect, it } from "vitest";
import {
	createDefaultSettings,
	parseStoredSettings,
	SETTINGS_SCHEMA_VERSION,
} from "../src/shared/settings-schema";

describe("settings schema", () => {
	it("accepts defaults at current schema version", () => {
		const defaults = createDefaultSettings();
		const result = parseStoredSettings(defaults);

		expect(result.resetReason).toBeUndefined();
		expect(result.settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
	});

	it("migrates v2 payload to v3 by adding opencode defaults", () => {
		const defaults = createDefaultSettings();
		const v2Payload = {
			...defaults,
			schemaVersion: 2,
		} as Record<string, unknown>;
		delete v2Payload.opencode;
		const result = parseStoredSettings(v2Payload);

		expect(result.resetReason).toBeUndefined();
		expect(result.settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
		expect(result.settings.opencode.id).toBe("opencode");
		expect(result.settings.opencode.args).toEqual(["acp"]);
	});

	it("resets on unmigrateable schema version", () => {
		const legacyPayload = {
			...createDefaultSettings(),
			schemaVersion: 1,
		};
		const result = parseStoredSettings(legacyPayload);

		expect(result.resetReason).toContain("schema version mismatch");
		expect(result.settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
	});
});
