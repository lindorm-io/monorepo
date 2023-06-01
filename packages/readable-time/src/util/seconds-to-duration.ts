import { DurationDictionary } from "../types";
import { millisecondsToDuration } from "./milliseconds-to-duration";

export const secondsToDuration = (seconds: number): DurationDictionary =>
  millisecondsToDuration(seconds * 1000);

export const secondsDuration = secondsToDuration;
