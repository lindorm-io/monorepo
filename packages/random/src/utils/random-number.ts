const maximum = (length: number): number => parseInt("".padEnd(length, "9"), 10);

export const randomNumber = (length: number): number =>
  Math.floor(Math.random() * maximum(length));
