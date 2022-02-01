import { timingSafeEqual } from "crypto";

const padAndBuffer = (string: string, maxLength: number): Buffer => {
  const adjusted = string.padEnd(maxLength, "#").substring(0, maxLength);
  return Buffer.from(adjusted, "utf8");
};

export const stringComparison = (string: string, comparison: string): boolean => {
  const maxLength = Math.max(string.length, comparison.length);
  return timingSafeEqual(padAndBuffer(string, maxLength), padAndBuffer(comparison, maxLength));
};
