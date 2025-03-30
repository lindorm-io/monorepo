import { Expiry } from "@lindorm/date";

export type CookieEncoding = "base64" | "base64url" | "hex";
export type CookiePriority = "low" | "medium" | "high";
export type CookieSameSite = "strict" | "lax" | "none";

export type PylonCookieOptions = {
  domain?: string;
  encoding?: CookieEncoding;
  encrypted?: boolean;
  expiry?: Expiry;
  httpOnly?: boolean;
  partitioned?: boolean;
  path?: string;
  priority?: CookiePriority;
  sameSite?: CookieSameSite;
  secure?: boolean;
  signed?: boolean;
};

export type PylonCookieConfig = Pick<
  PylonCookieOptions,
  "domain" | "encoding" | "httpOnly" | "sameSite" | "secure"
>;

export type PylonSetCookie = PylonCookieOptions;

export type PylonGetCookie = Pick<PylonCookieOptions, "encoding"> & {
  encrypted?: boolean;
  signed?: boolean;
};
