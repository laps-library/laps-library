export const PAGE_ORDER: Record<string, number> = {
  "/home": 0,
  "/catalog": 1,
  "/reserve": 2,
  "/profile": 3,
  "/news": 4,
  "/forum": 5,
};

export function rotationBetween(from: string, to: string): number {
  const a = PAGE_ORDER[from];
  const b = PAGE_ORDER[to];
  if (a === undefined || b === undefined) return 0;
  if (a === b) return 0;
  return b > a ? 1 : -1;
}
