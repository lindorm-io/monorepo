export type RandomStringAmount = "random" | "1/2" | "1/3" | "1/4" | "1/5" | "1/6" | number;

export type RandomStringCustom = {
  chars?: string;
  numbers?: string;
  symbols?: string;
};

export type RandomStringOptions = {
  numbers?: RandomStringAmount;
  symbols?: RandomStringAmount;
  custom?: RandomStringCustom;
};
