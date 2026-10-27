import { Trace } from "loading-dev";

export function Spinner({
	color = "#f97316",
	size = 20,
}: {
	color?: string;
	size?: number;
}) {
	return <Trace color={color} easing="stacked" size={size} />;
}
