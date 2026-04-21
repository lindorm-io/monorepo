import { isArray } from "@lindorm/is";
import type { CorsOptions } from "../../../types/index.js";

const normalize = (origin: string): string => {
  const lower = origin.toLowerCase();
  return lower.endsWith("/") ? lower.slice(0, -1) : lower;
};

export const matchOrigin = (
  origin: string | undefined,
  allowOrigins: CorsOptions["allowOrigins"],
): boolean => {
  if (!origin) return false;

  if (allowOrigins === "*") return true;

  if (!isArray(allowOrigins) || allowOrigins.length === 0) return false;

  const needle = normalize(origin);

  return allowOrigins.some((allowed) => normalize(allowed) === needle);
};
