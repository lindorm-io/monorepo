import { RandomStringAmount } from "../../types/private";
import { randomInt } from "./random-int";

export const getAmount = (length: number, amount?: RandomStringAmount): number => {
  if (typeof amount === "number") {
    return amount;
  }

  if (typeof amount !== "string") {
    throw new Error("Invalid amount");
  }

  if (amount === "random") {
    return randomInt(0, length / 3);
  }

  if (amount.endsWith("%")) {
    const percent = parseFloat(`0.${amount.replace("%", "")}`);
    return Math.round(length * percent);
  }

  throw new Error("Invalid amount");
};
