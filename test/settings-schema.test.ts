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
});
