import { CreateRandomStringOptions } from "../../types/private/types";
import { getAmount } from "./get-amount";
import { getSymbols } from "./get-symbols";
import { randomSort } from "./random-sort";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";

export const createRandomString = (
  length: number,
  options: CreateRandomStringOptions = {},
): string => {
  const { custom = "default", numbersMax = 0, symbolsMax = 0 } = options;

  const lengthInt = Math.round(length);
  const numbersAmount = getAmount(lengthInt, numbersMax);
  const symbolsAmount = getAmount(lengthInt, symbolsMax);
  const symbols = getSymbols(custom);

  const result: string[] = [];

  for (let i = 0; i < numbersAmount; i++) {
    result.push(NUMBERS.charAt(Math.floor(Math.random() * NUMBERS.length)));
  }

  for (let i = 0; i < symbolsAmount; i++) {
    result.push(symbols.charAt(Math.floor(Math.random() * symbols.length)));
  }

  while (result.length < lengthInt) {
    result.push(CHARS.charAt(Math.floor(Math.random() * CHARS.length)));
  }

  return result.sort(randomSort).join("");
};
