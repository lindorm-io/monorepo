import { randomInteger } from "./random-integer";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SYMBOLS = "!()-.,/?[]_~;:!@#$%^&*+=<>{}";

const randomSort = () => 0.5 - Math.random();

type Options = {
  numbers?: "random" | number;
  symbols?: "random" | number;
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

  for (let i = 0; i < numbersAmount; i++) {
    result.push(randomInteger(9).toString());
  }

  for (let i = 0; i < symbolsAmount; i++) {
    result.push(SYMBOLS.charAt(Math.floor(Math.random() * SYMBOLS.length)));
  }

  while (result.length < charsAmount) {
    result.push(CHARS.charAt(Math.floor(Math.random() * CHARS.length)));
  }

  return result.sort(randomSort).join("");
};
