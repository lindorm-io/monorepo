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

export type CustomSymbols = "default" | "secret" | "token" | "unreserved";

export type CreateRandomStringOptions = {
  custom?: CustomSymbols;
  numbersMax?: RandomStringAmount;
  symbolsMax?: RandomStringAmount;
};
