export type CaseCallback = (arg: string) => string;
export type CaseInput = Record<string, any> | Array<string> | string;
export type TransformMode =
  | "camel"
  | "constant"
  | "dot"
  | "header"
  | "param"
  | "pascal"
  | "snake"
  | "none";
