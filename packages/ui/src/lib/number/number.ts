/**
 * Clamps a number within a specified range.
 */
function clamp(value: number, [min, max]: [number, number]): number {
	return Math.min(max, Math.max(min, value));
}

export { clamp };
