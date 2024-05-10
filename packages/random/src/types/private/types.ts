export type _RandomStringAmount =
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

export type _CustomSymbols = "default" | "secret" | "token" | "unreserved";

export type _CreateRandomStringOptions = {
  custom?: _CustomSymbols;
  numbersMax?: _RandomStringAmount;
  symbolsMax?: _RandomStringAmount;
};
