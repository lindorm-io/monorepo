const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!#$%&()*+,-./:;<=>?@[]^_{|}~";

const pickChars = (alphabet: string, count: number): string[] => {
  const result: string[] = [];
  const limit = 256 - (256 % alphabet.length);
  while (result.length < count) {
    const batch = new Uint8Array(Math.ceil((count - result.length) * 1.5) + 8);
    globalThis.crypto.getRandomValues(batch);
    for (const byte of batch) {
      if (byte < limit && result.length < count) {
        result.push(alphabet[byte % alphabet.length]);
      }
    }
  }
  return result;
};

const shuffle = (arr: string[]): void => {
  const randoms = new Uint32Array(arr.length);
  globalThis.crypto.getRandomValues(randoms);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randoms[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
};

export const createRandomString = (length: number, numbers = 0, symbols = 0): string => {
  const letterCount = length - numbers - symbols;
  if (letterCount < 0) {
    throw new Error("numbers + symbols cannot exceed length");
  }
  const result = [
    ...pickChars(DIGITS, numbers),
    ...pickChars(SYMBOLS, symbols),
    ...pickChars(LETTERS, letterCount),
  ];
  shuffle(result);
  return result.join("");
};
