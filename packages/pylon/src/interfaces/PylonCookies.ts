import { PylonGetCookie, PylonSetCookie } from "../types";

export interface IPylonCookies {
  set<T = any>(name: string, value: T, options?: PylonSetCookie): Promise<void>;
  get<T = any>(name: string, options?: PylonGetCookie): Promise<T | null>;
  del(name: string): void;
}
