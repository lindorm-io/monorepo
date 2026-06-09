import { RedisDriverError } from "../errors/RedisDriverError.js";

export const encodePkSegment = (value: unknown): string => {
  if (value == null) {
    throw new RedisDriverError("PK segment value must not be null or undefined", {
      code: "invalid_primary_key",
      title: "Invalid Primary Key",
      details:
        "A primary key segment used to build the Redis key was null or undefined; every primary key column must have a defined value.",
    });
  }
  return encodeURIComponent(String(value));
};
