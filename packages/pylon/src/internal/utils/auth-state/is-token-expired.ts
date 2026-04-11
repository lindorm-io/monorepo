export const isTokenExpired = (expiresAt: Date, now: Date): boolean =>
  now.getTime() >= expiresAt.getTime();
