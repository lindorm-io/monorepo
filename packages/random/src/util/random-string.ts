import { randomInteger } from "./random-integer";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!()-.,/?[]_~;:!@#$%^&*+=<>{}";

const randomSort = () => 0.5 - Math.random();

type Custom = {
  chars?: string;
  numbers?: string;
  symbols?: string;
};

type Options = {
  numbers?: "random" | number;
  symbols?: "random" | number;
  custom?: Custom;
};

export const randomString = (length: number, options: Options = {}): string => {
  const charsAmount = Math.round(length);
  const numbersAmount = Math.round(
    options.numbers === "random"
      ? randomInteger(charsAmount / 2)
      : options.numbers
      ? options.numbers
      : 0,
  );
  const symbolsAmount = Math.round(
    options.symbols === "random"
      ? randomInteger(charsAmount / 3)
      : options.symbols
      ? options.symbols
      : 0,
  );

  const result: string[] = [];

  const { chars = CHARS, numbers = NUMBERS, symbols = SYMBOLS } = options.custom || {};

  for (let i = 0; i < numbersAmount; i++) {
    result.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
  }

  for (let i = 0; i < symbolsAmount; i++) {
    result.push(symbols.charAt(Math.floor(Math.random() * symbols.length)));
  }

  while (result.length < charsAmount) {
    result.push(chars.charAt(Math.floor(Math.random() * chars.length)));
  }

  return result.sort(randomSort).join("");
};
