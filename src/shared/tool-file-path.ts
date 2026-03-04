const FILE_PATH_KEYS = [
	"file_path",
	"filePath",
	"path",
	"filepath",
	"filename",
	"file",
	"target_file",
	"targetFile",
	"source_file",
	"sourceFile",
	"resource_path",
	"resourcePath",
	"uri",
] as const;

const FILE_PATH_ARRAY_KEYS = ["paths", "files"] as const;

const NESTED_INPUT_KEYS = ["input", "arguments", "params", "payload"] as const;

function readString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

function readStringArrayFirst(value: unknown): string | null {
	if (!Array.isArray(value)) return null;
	for (const item of value) {
		const next = readString(item);
		if (next) return next;
	}
	return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function extractFromRecord(
	record: Record<string, unknown>,
	depth: number,
): string | null {
	for (const key of FILE_PATH_KEYS) {
		const direct = readString(record[key]);
		if (direct) return direct;
	}

	for (const key of FILE_PATH_ARRAY_KEYS) {
		const fromArray = readStringArrayFirst(record[key]);
		if (fromArray) return fromArray;
	}

	const argsFirst = readStringArrayFirst(record.args);
	if (argsFirst) return argsFirst;

	if (depth <= 0) return null;

	for (const key of NESTED_INPUT_KEYS) {
		const nested = asRecord(record[key]);
		if (!nested) continue;
		const next = extractFromRecord(nested, depth - 1);
		if (next) return next;
	}

	return null;
}

export function extractToolFilePath(rawInput: unknown): string {
	const input = asRecord(rawInput);
	if (!input) return "";
	return extractFromRecord(input, 2) ?? "";
}
