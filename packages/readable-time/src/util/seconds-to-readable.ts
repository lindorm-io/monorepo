import { ReadableShort } from "../types";
import { millisecondsToReadable } from "./milliseconds-to-readable";

export const secondsToReadable = (seconds: number): ReadableShort =>
  millisecondsToReadable(seconds * 1000);

export const secondsReadable = secondsToReadable;
