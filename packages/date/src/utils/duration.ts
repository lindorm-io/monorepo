import { DurationDict, ReadableTime } from "../types";
import { millisecondsToDuration } from "./private/milliseconds-to-duration";
import { readableToDuration } from "./private/readable-to-duration";

export function duration(milliseconds: number): DurationDict;
export function duration(readable: ReadableTime): DurationDict;
export function duration(arg: ReadableTime | number): DurationDict {
  if (typeof arg === "number") return millisecondsToDuration(arg);
  return readableToDuration(arg);
}
