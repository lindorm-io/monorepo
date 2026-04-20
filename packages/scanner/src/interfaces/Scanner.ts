import { IScanData } from "../interfaces";

export interface IScanner {
  scan(path: string): IScanData;
  import<T>(fileOrPath: IScanData | string): Promise<T>;
}
