import { useState, useEffect } from "react";
import type AgentClientPlugin from "../plugin";
import { getLogger } from "../shared/logger";

export function useUpdateCheck(plugin: AgentClientPlugin): boolean {
	const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
	const logger = getLogger();

	useEffect(() => {
		plugin
			.checkForUpdates()
			.then(setIsUpdateAvailable)
			.catch((error) => {
				logger.error("Failed to check for updates:", error);
			});
	}, [plugin, logger]);

	return isUpdateAvailable;
}
