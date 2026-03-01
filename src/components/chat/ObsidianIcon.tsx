import * as React from "react";
const { useRef, useEffect } = React;
import { setIcon } from "obsidian";

interface ObsidianIconProps {
	name: string;
	className?: string;
	size?: number;
}

export function ObsidianIcon({ name, className, size }: ObsidianIconProps) {
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (ref.current) {
			ref.current.empty();
			setIcon(ref.current, name);
			if (size) {
				const svg = ref.current.querySelector("svg");
				if (svg) {
					svg.setAttribute("width", `${size}`);
					svg.setAttribute("height", `${size}`);
				}
			}
		}
	}, [name, size]);

	return <span ref={ref} className={className} aria-hidden="true" />;
}
