import type { IScanData } from "../interfaces/index.js";

export interface IScanner {
  scan(path: string): IScanData;
  import<T>(fileOrPath: IScanData | string): Promise<T>;
}
