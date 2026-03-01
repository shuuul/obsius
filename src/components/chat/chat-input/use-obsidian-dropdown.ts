import { useEffect, useRef } from "react";
import { DropdownComponent } from "obsidian";

export interface ObsidianDropdownOption {
	id: string;
	label: string;
}

function serializeOptions(
	options: ObsidianDropdownOption[] | undefined,
): string {
	if (!options) return "";
	return options.map((o) => `${o.id}\0${o.label}`).join("\n");
}

export function useObsidianDropdown(
	options: ObsidianDropdownOption[] | undefined,
	currentValue: string | undefined,
	onChange?: (value: string) => void,
) {
	const containerRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<DropdownComponent | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const optionsKey = serializeOptions(options);

	useEffect(() => {
		const containerEl = containerRef.current;
		if (!containerEl) return;

		if (dropdownRef.current) {
			containerEl.empty();
			dropdownRef.current = null;
		}

		if (!options || options.length <= 1) {
			return;
		}

		const dropdown = new DropdownComponent(containerEl);
		dropdownRef.current = dropdown;
		for (const option of options) {
			dropdown.addOption(option.id, option.label);
		}
		if (currentValue) {
			dropdown.setValue(currentValue);
		}
		dropdown.onChange((value) => {
			onChangeRef.current?.(value);
		});

		return () => {
			if (dropdownRef.current) {
				containerEl.empty();
				dropdownRef.current = null;
			}
		};
	}, [optionsKey, currentValue]);

	useEffect(() => {
		if (dropdownRef.current && currentValue) {
			dropdownRef.current.setValue(currentValue);
		}
	}, [currentValue]);

	return containerRef;
}
