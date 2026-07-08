import { isString } from "@lindorm/is";
import { Cron } from "croner";

/**
 * Type guard for a valid standard cron expression (e.g. `"0 0 * * *"`). Returns
 * `true` when the string parses as a cron schedule, `false` otherwise. Parallels
 * {@link isReadableTime} for the cron half of the scheduling API.
 */
export const isCron = (input: any): input is string => {
  if (!isString(input)) return false;

  try {
    new Cron(input);
    return true;
  } catch {
    return false;
  }
};
