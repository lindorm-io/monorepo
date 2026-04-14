import { DurationDict, ReadableTime } from "../types";
import { millisecondsToDuration, readableToDuration } from "#internal/utils";

export function duration(milliseconds: number): DurationDict;
export function duration(readable: ReadableTime): DurationDict;
export function duration(arg: ReadableTime | number): DurationDict {
  if (typeof arg === "number") return millisecondsToDuration(arg);
  return readableToDuration(arg);
}
