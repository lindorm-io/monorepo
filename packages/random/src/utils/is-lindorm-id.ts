import { LINDORM_ID_PATTERN } from "./lindorm-id-pattern.js";

/** True when the value is a string in the `lindormId` format. */
export const isLindormId = (value: unknown): boolean =>
  typeof value === "string" && LINDORM_ID_PATTERN.test(value);
