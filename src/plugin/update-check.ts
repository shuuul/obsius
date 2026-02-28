import { Notice, requestUrl } from "obsidian";
import * as semver from "semver";

async function fetchLatestStable(): Promise<string | null> {
	const response = await requestUrl({
		url: "https://api.github.com/repos/RAIT-09/obsidian-agent-client/releases/latest",
	});
	const data = response.json as { tag_name?: string };
	return data.tag_name ? semver.clean(data.tag_name) : null;
}

async function fetchLatestPrerelease(): Promise<string | null> {
	const response = await requestUrl({
		url: "https://api.github.com/repos/RAIT-09/obsidian-agent-client/releases",
	});
	const releases = response.json as Array<{
		tag_name: string;
		prerelease: boolean;
	}>;
	const latestPrerelease = releases.find((r) => r.prerelease);
	return latestPrerelease ? semver.clean(latestPrerelease.tag_name) : null;
}

export async function checkForUpdates(currentVersionInput: string): Promise<boolean> {
	const currentVersion = semver.clean(currentVersionInput) || currentVersionInput;
	const isCurrentPrerelease = semver.prerelease(currentVersion) !== null;

	if (isCurrentPrerelease) {
		const [latestStable, latestPrerelease] = await Promise.all([
			fetchLatestStable(),
			fetchLatestPrerelease(),
		]);

		const hasNewerStable = latestStable && semver.gt(latestStable, currentVersion);
		const hasNewerPrerelease =
			latestPrerelease && semver.gt(latestPrerelease, currentVersion);

		if (hasNewerStable || hasNewerPrerelease) {
			const newestVersion = hasNewerStable ? latestStable : latestPrerelease;
			new Notice(`[Agent Client] Update available: v${newestVersion}`);
			return true;
		}
	} else {
		const latestStable = await fetchLatestStable();
		if (latestStable && semver.gt(latestStable, currentVersion)) {
			new Notice(`[Agent Client] Update available: v${latestStable}`);
			return true;
		}
	}

	return false;
}
