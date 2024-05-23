import { ReadableTime } from "../types";
import { millisecondsToReadable } from "./private/milliseconds-to-readable";
import { readableToMilliseconds } from "./private/readable-to-milliseconds";

export function ms(milliseconds: number): ReadableTime;
export function ms(readable: ReadableTime): number;
export function ms(arg: ReadableTime | number): ReadableTime | number {
  if (typeof arg === "number") return millisecondsToReadable(arg);
  return readableToMilliseconds(arg);
}
