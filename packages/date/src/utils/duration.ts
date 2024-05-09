import { DurationDict, ReadableTime } from "../types";
import { _millisecondsToDuration } from "./private/milliseconds-to-duration";
import { _readableToDuration } from "./private/readable-to-duration";

export function duration(milliseconds: number): DurationDict;
export function duration(readable: ReadableTime): DurationDict;
export function duration(arg: ReadableTime | number): DurationDict {
  if (typeof arg === "number") return _millisecondsToDuration(arg);
  return _readableToDuration(arg);
}
