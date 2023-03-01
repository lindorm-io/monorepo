import { randomInteger } from "./random-integer";
import { RandomStringAmount, RandomStringOptions } from "../types";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!()-.,/?[]_~;:!@#$%^&*+=<>{}";

const randomSort = () => 0.5 - Math.random();

const calculateAmount = (length: number, amount: RandomStringAmount): number => {
  switch (amount) {
    case "random":
      return randomInteger(length / 3);
    case "1/2":
      return Math.round(length / 2);
    case "1/3":
      return Math.round(length / 3);
    case "1/4":
      return Math.round(length / 4);
    case "1/5":
      return Math.round(length / 5);
    case "1/6":
      return Math.round(length / 6);
    default:
      return amount;
  }
};

export const randomString = (length: number, options: RandomStringOptions = {}): string => {
  const { numbers: numbersMax = 0, symbols: symbolsMax = 0 } = options;

  const lengthInt = Math.round(length);
  const numbersAmount = calculateAmount(lengthInt, numbersMax);
  const symbolsAmount = calculateAmount(lengthInt, symbolsMax);

  const result: string[] = [];

  const { chars = CHARS, numbers = NUMBERS, symbols = SYMBOLS } = options.custom || {};

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
