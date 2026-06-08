import { RedisDriverError } from "../errors/RedisDriverError.js";

export const encodePkSegment = (value: unknown): string => {
  if (value == null) {
    throw new RedisDriverError("PK segment value must not be null or undefined", {
      code: "invalid_primary_key",
    });
  }
  return encodeURIComponent(String(value));
};
