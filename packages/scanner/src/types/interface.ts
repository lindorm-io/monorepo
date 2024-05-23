import { ScanData } from "./types";

export interface IScanner {
  scan(...paths: Array<string>): Array<ScanData>;
  import<T>(fileOrPath: ScanData | string): Promise<T>;
  require<T>(fileOrPath: ScanData | string): T;
}
