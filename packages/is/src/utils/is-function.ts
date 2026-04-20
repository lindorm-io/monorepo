import { Function as FunctionType } from "@lindorm/types";

export const isFunction = (input?: any): input is FunctionType =>
  Boolean(input) && (input instanceof Function || typeof input === "function");
