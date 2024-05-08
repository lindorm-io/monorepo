import { Function } from "@lindorm/types";

// eslint-disable-next-line @typescript-eslint/ban-types
export const isFunction = (input?: any): input is Function =>
  Boolean(input) && (input instanceof Function || typeof input === "function");
