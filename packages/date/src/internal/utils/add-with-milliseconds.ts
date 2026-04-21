import { add, addMilliseconds } from "date-fns";
import type { DurationDict } from "../../types/index.js";

export const addWithMilliseconds = (date: Date, duration: DurationDict): Date => {
  const added = add(date, duration);

  if (!duration.milliseconds) return added;

  return addMilliseconds(added, duration.milliseconds);
};
