export const isInExpiryWarningWindow = (
  expiresAt: Date,
  now: Date,
  warningMs: number,
): boolean => {
  const diff = expiresAt.getTime() - now.getTime();
  return diff > 0 && diff <= warningMs;
};
