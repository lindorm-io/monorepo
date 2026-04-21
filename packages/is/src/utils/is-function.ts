import type { Function as FunctionType } from "@lindorm/types";

export const isFunction = (input?: any): input is FunctionType =>
  Boolean(input) && typeof input === "function";
