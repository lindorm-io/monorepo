import { ReadableTime } from "../types";
import { millisecondsToReadable, readableToMilliseconds } from "./private";

export function ms(milliseconds: number): ReadableTime;
export function ms(readable: ReadableTime): number;
export function ms(arg: ReadableTime | number): ReadableTime | number {
  if (typeof arg === "number") return millisecondsToReadable(arg);
  return readableToMilliseconds(arg);
}
