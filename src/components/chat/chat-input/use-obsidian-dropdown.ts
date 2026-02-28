import { useEffect, useRef } from "react";
import { DropdownComponent } from "obsidian";

export interface ObsidianDropdownOption {
	id: string;
	label: string;
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

	useEffect(() => {
		const containerEl = containerRef.current;
		if (!containerEl) return;

		if (!options || options.length <= 1) {
			if (dropdownRef.current) {
				containerEl.empty();
				dropdownRef.current = null;
			}
			return;
		}

		if (!dropdownRef.current) {
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
		}

		return () => {
			if (dropdownRef.current) {
				containerEl.empty();
				dropdownRef.current = null;
			}
		};
	}, [options, currentValue]);

	useEffect(() => {
		if (dropdownRef.current && currentValue) {
			dropdownRef.current.setValue(currentValue);
		}
	}, [currentValue]);

	return containerRef;
}
