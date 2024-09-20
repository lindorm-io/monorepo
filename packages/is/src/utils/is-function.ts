import { Function } from "@lindorm/types";

export const isFunction = (input?: any): input is Function =>
  Boolean(input) && (input instanceof Function || typeof input === "function");
