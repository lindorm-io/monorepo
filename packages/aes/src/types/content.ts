import { Dict } from "@lindorm/types";

export type AesContent = Array<any> | boolean | Buffer | Dict | number | string;

export type AesContentType =
  | "application/json"
  | "application/octet-stream"
  | "text/plain";
