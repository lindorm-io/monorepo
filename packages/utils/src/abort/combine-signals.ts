export const combineSignals = (
  a: AbortSignal | undefined,
  b: AbortSignal | undefined,
): AbortSignal | undefined => {
  if (!a) return b;
  if (!b) return a;
  return AbortSignal.any([a, b]);
};
