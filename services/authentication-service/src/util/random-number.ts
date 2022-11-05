import randomNumber from "random-number-csprng";

const maximum = (length: number): number => {
  return parseInt("".padEnd(length, "9"), 10);
};

export const randomNumberAsync = async (length: number): Promise<number> => {
  return await randomNumber(0, maximum(length));
};
