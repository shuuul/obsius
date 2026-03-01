import * as React from "react";

const CDN_BASE =
	"https://unpkg.com/@lobehub/icons-static-svg@latest/icons";

interface ProviderLogoProps {
	slug: string;
	size?: number;
	className?: string;
}

/**
 * Renders a provider brand logo from the @lobehub/icons CDN.
 * Uses CSS mask-image so the SVG inherits `currentColor` from the theme,
 * working correctly in both light and dark modes with zero bundle impact.
 */
export function ProviderLogo({ slug, size = 14, className }: ProviderLogoProps) {
	const url = `${CDN_BASE}/${slug}.svg`;
	const maskStyle: React.CSSProperties = {
		display: "inline-block",
		width: size,
		height: size,
		backgroundColor: "currentColor",
		WebkitMaskImage: `url(${url})`,
		WebkitMaskSize: "contain",
		WebkitMaskRepeat: "no-repeat",
		WebkitMaskPosition: "center",
		maskImage: `url(${url})`,
		maskSize: "contain",
		maskRepeat: "no-repeat",
		maskPosition: "center",
	};

	return <span className={className} aria-hidden="true" style={maskStyle} />;
}
