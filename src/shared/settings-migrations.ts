export type SettingsMigrationFn = (
	data: Record<string, unknown>,
) => Record<string, unknown>;

interface Migration {
	from: number;
	to: number;
	migrate: SettingsMigrationFn;
}

const migrations: Migration[] = [];

export function registerMigration(
	from: number,
	to: number,
	migrate: SettingsMigrationFn,
): void {
	migrations.push({ from, to, migrate });
	migrations.sort((a, b) => a.from - b.from);
}

export function migrateSettings(
	data: Record<string, unknown>,
	targetVersion: number,
): { data: Record<string, unknown>; migrated: boolean } {
	let current = data;
	let version = (current.schemaVersion as number) ?? 0;
	let migrated = false;

	while (version < targetVersion) {
		const migration = migrations.find((m) => m.from === version);
		if (!migration) break;

		current = migration.migrate({ ...current });
		version = migration.to;
		current.schemaVersion = version;
		migrated = true;
	}

	return { data: current, migrated };
}

export function getMigrationPath(
	fromVersion: number,
	targetVersion: number,
): number[] {
	const path: number[] = [fromVersion];
	let version = fromVersion;

	while (version < targetVersion) {
		const migration = migrations.find((m) => m.from === version);
		if (!migration) break;
		version = migration.to;
		path.push(version);
	}

	return path;
}

export function hasMigrationPath(
	fromVersion: number,
	targetVersion: number,
): boolean {
	const path = getMigrationPath(fromVersion, targetVersion);
	return path[path.length - 1] === targetVersion;
}
