import { Level } from "@lindorm-io/core-logger";

export const LEVEL_VALUE: Record<Level, number> = {
  error: 5,
  warn: 4,
  info: 3,
  verbose: 2,
  debug: 1,
  silly: 0,
};
