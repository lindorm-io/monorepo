import { _CreateRandomStringOptions } from "../../types/private/types";
import { _getAmount } from "./get-amount";
import { _getSymbols } from "./get-symbols";
import { _randomSort } from "./random-sort";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";

export const _createRandomString = (
  length: number,
  options: _CreateRandomStringOptions = {},
): string => {
  const { customSymbols = "default", numbersMax = 0, symbolsMax = 0 } = options;

  const lengthInt = Math.round(length);
  const numbersAmount = _getAmount(lengthInt, numbersMax);
  const symbolsAmount = _getAmount(lengthInt, symbolsMax);
  const symbols = _getSymbols(customSymbols);

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

  return result.sort(_randomSort).join("");
};
