import { add, addMilliseconds } from "date-fns";
import { DurationDict } from "../../types";

export const addWithMilliseconds = (date: Date, duration: DurationDict): Date => {
  const added = add(date, duration);

  if (!duration.milliseconds) return added;

  return addMilliseconds(added, duration.milliseconds);
};
