const maximum = (length: number): number => {
  return parseInt("".padEnd(length, "9"), 10);
};

export const getRandomNumber = (length: number): number => {
  return Math.floor(Math.random() * maximum(length));
};

export const randomNumber = getRandomNumber;
