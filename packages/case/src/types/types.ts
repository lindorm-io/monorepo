import { Dict } from "@lindorm/types";

export type ChangeCase =
  | "camel"
  | "capital"
  | "constant"
  | "dot"
  | "header"
  | "kebab"
  | "lower"
  | "pascal"
  | "path"
  | "sentence"
  | "snake"
  | "none";

export type CaseCallback = (input: string) => string;

export type KeysInput = Dict | Array<Dict>;
