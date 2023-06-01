import { ReadableTime } from "../types";
import { millisecondsToReadable } from "./milliseconds-to-readable";
import { readableToMilliseconds } from "./readable-to-milliseconds";

export function ms(milliseconds: number): ReadableTime;
export function ms(readable: ReadableTime): number;
export function ms(value: ReadableTime | number): ReadableTime | number {
  if (typeof value === "number") return millisecondsToReadable(value);
  return readableToMilliseconds(value);
}
