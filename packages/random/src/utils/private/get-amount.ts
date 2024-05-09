import { _RandomStringAmount } from "../../types/private/types";
import { _randomInt } from "./random-int";

export const _getAmount = (length: number, amount?: _RandomStringAmount): number => {
  if (typeof amount === "number") {
    return amount;
  }

  if (typeof amount !== "string") {
    throw new Error("Invalid amount");
  }

  if (amount === "random") {
    return _randomInt(length / 3);
  }

  if (amount.endsWith("%")) {
    const percent = parseFloat(`0.${amount.replace("%", "")}`);
    return Math.round(length * percent);
  }

  throw new Error("Invalid amount");
};
