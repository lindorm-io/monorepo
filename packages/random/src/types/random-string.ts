export type RandomStringAmount =
  | "random"
  | "10%"
  | "20%"
  | "30%"
  | "40%"
  | "50%"
  | "60%"
  | "70%"
  | "80%"
  | "90%"
  | number;

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
