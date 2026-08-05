import { isExpired } from "@lindorm/date";

export const isTokenExpired = (expiresAt: Date, now: Date): boolean =>
  isExpired(expiresAt, now);
