import type { PylonGetCookieOptions, PylonSetCookieOptions } from "../types/index.js";

export interface IPylonCookies {
  set<T = any>(name: string, value: T, options?: PylonSetCookieOptions): Promise<void>;
  get<T = any>(name: string, options?: PylonGetCookieOptions): Promise<T | null>;
  del(name: string): void;
}
