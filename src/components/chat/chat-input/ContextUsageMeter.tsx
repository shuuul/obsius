import * as React from "react";

export interface ContextUsage {
	size: number;
	used: number;
}

interface ContextUsageMeterProps {
	usage: ContextUsage | null;
	isSessionReady: boolean;
}

const SVG_SIZE = 16;
const STROKE_WIDTH = 2;
const RADIUS = (SVG_SIZE - STROKE_WIDTH) / 2;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;

const START_ANGLE = 150;
const END_ANGLE = 390;
const ARC_DEGREES = END_ANGLE - START_ANGLE;
const ARC_RADIANS = (ARC_DEGREES * Math.PI) / 180;
const CIRCUMFERENCE = RADIUS * ARC_RADIANS;

const START_RAD = (START_ANGLE * Math.PI) / 180;
const END_RAD = (END_ANGLE * Math.PI) / 180;
const X1 = CX + RADIUS * Math.cos(START_RAD);
const Y1 = CY + RADIUS * Math.sin(START_RAD);
const X2 = CX + RADIUS * Math.cos(END_RAD);
const Y2 = CY + RADIUS * Math.sin(END_RAD);

const ARC_D = `M ${X1} ${Y1} A ${RADIUS} ${RADIUS} 0 1 1 ${X2} ${Y2}`;

function formatTokens(tokens: number): string {
	if (tokens >= 1000) {
		return `${Math.round(tokens / 1000)}k`;
	}
	return String(tokens);
}

export function ContextUsageMeter({
	usage,
	isSessionReady,
}: ContextUsageMeterProps) {
	if (!isSessionReady && !usage) {
		return null;
	}

	const hasUsage = usage && usage.size > 0;
	const percentage = hasUsage
		? Math.min(100, Math.round((usage.used / usage.size) * 100))
		: 0;
	const isWarning = percentage > 80;
	const fillOffset = CIRCUMFERENCE - (percentage / 100) * CIRCUMFERENCE;

	const tooltip = hasUsage
		? isWarning
			? `${formatTokens(usage.used)} / ${formatTokens(usage.size)} (Approaching limit)`
			: `${formatTokens(usage.used)} / ${formatTokens(usage.size)}`
		: "Context usage";

	return (
		<div
			className={`obsius-context-meter${isWarning ? " obsius-context-meter-warning" : ""}`}
			title={tooltip}
		>
			<svg
				className="obsius-context-meter-gauge"
				width={SVG_SIZE}
				height={SVG_SIZE}
				viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
			>
				<path
					className="obsius-meter-bg"
					d={ARC_D}
					fill="none"
					strokeWidth={STROKE_WIDTH}
					strokeLinecap="round"
				/>
				<path
					className="obsius-meter-fill"
					d={ARC_D}
					fill="none"
					strokeWidth={STROKE_WIDTH}
					strokeLinecap="round"
					strokeDasharray={CIRCUMFERENCE}
					strokeDashoffset={fillOffset}
				/>
			</svg>
			<span className="obsius-context-meter-percent">{percentage}%</span>
		</div>
	);
}
