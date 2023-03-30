import { DEFAULT_SYMBOLS } from "../constants";
import { RandomStringAmount, RandomStringOptions } from "../types";
import { randomInteger } from "./random-integer";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";

const randomSort = (): number => 0.5 - Math.random();

const calculateAmount = (length: number, amount?: RandomStringAmount): number => {
  if (typeof amount === "number") {
    return amount;
  }

  if (typeof amount !== "string") {
    throw new Error("Invalid amount");
  }

  if (amount === "random") {
    return randomInteger(length / 3);
  }

  if (amount.endsWith("%")) {
    const percent = parseFloat(`0.${amount.replace("%", "")}`);
    return Math.round(length * percent);
  }

  throw new Error("Invalid amount");
};

export const randomString = (length: number, options: RandomStringOptions = {}): string => {
  const { numbers: numbersMax = 0, symbols: symbolsMax = 0 } = options;

  const lengthInt = Math.round(length);
  const numbersAmount = calculateAmount(lengthInt, numbersMax);
  const symbolsAmount = calculateAmount(lengthInt, symbolsMax);

  const result: string[] = [];

  const {
    chars = CHARS,
    numbers = NUMBERS,
    symbols = DEFAULT_SYMBOLS.join(""),
  } = options.custom || {};

  for (let i = 0; i < numbersAmount; i++) {
    result.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
  }

  for (let i = 0; i < symbolsAmount; i++) {
    result.push(symbols.charAt(Math.floor(Math.random() * symbols.length)));
  }

  while (result.length < lengthInt) {
    result.push(chars.charAt(Math.floor(Math.random() * chars.length)));
  }

  return result.sort(randomSort).join("");
};
