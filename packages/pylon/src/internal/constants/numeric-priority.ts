import { Priority } from "@lindorm/types";

export const NUMERIC_PRIORITY: Record<Priority, number> = {
  critical: 9,
  high: 8,
  medium: 7,
  low: 6,

  default: 5,
  background: 1,
};
