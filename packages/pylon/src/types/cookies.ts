import { Expiry } from "@lindorm/date";

export type CookieEncoding = "base64" | "base64url" | "hex";
export type CookiePriority = "low" | "medium" | "high";
export type CookieSameSite = "strict" | "lax" | "none";

export type PylonCookieOptions = {
  domain?: string;
  expiry?: Expiry;
  httpOnly?: boolean;
  partitioned?: boolean;
  path?: string;
  priority?: CookiePriority;
  sameSite?: CookieSameSite;
  secure?: boolean;
};

export type PylonCookieConfig = Pick<
  PylonCookieOptions,
  "domain" | "httpOnly" | "sameSite" | "secure"
>;

export type PylonSetCookie = PylonCookieOptions & {
  encoding?: CookieEncoding;
  encrypted?: boolean;
  signed?: boolean;
};

export type PylonGetCookie = {
  encoding?: CookieEncoding;
  encrypted?: boolean;
  signed?: boolean;
};
