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

	it("resets on schema version mismatch", () => {
		const legacyPayload = {
			...createDefaultSettings(),
			schemaVersion: SETTINGS_SCHEMA_VERSION - 1,
		};
		const result = parseStoredSettings(legacyPayload);

		expect(result.resetReason).toContain("schema version mismatch");
		expect(result.settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
	});
});
