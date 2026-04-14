import { ReadableTime } from "../types";
import { millisecondsToReadable, readableToMilliseconds } from "#internal/utils";

export function sec(seconds: number): ReadableTime;
export function sec(readable: ReadableTime): number;
export function sec(arg: ReadableTime | number): ReadableTime | number {
  if (typeof arg === "number") return millisecondsToReadable(arg * 1000);
  return Math.floor(readableToMilliseconds(arg) / 1000);
}
