import { ReadableTime } from "../types";
import { readableToMilliseconds } from "./readable-to-milliseconds";

export const readableToSeconds = (...values: Array<ReadableTime>): number =>
  Math.round(readableToMilliseconds(...values) / 1000);

export const readableSeconds = readableToSeconds;
