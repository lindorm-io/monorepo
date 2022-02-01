export const baseHash = (input: string): string => {
  return Buffer.from(input).toString("base64");
};

export const baseParse = (input: string): string => {
  return Buffer.from(input, "base64").toString("utf8");
};
