import { Expiry } from "@lindorm/date";

export type CookiePriority = "low" | "medium" | "high";
export type CookieSameSite = "strict" | "lax";

export type CookieOptions = {
  encrypted?: boolean;
  expiry?: Expiry;
  httpOnly?: boolean;
  overwrite?: boolean;
  path?: string;
  priority?: CookiePriority;
  sameSite?: CookieSameSite;
  signed?: boolean;
};

export type PylonCookieConfig = {
  domain?: string;
  encrypted?: boolean;
  httpOnly?: boolean;
  overwrite?: boolean;
  priority?: CookiePriority;
  sameSite?: CookieSameSite;
  signatureKeys?: Array<string>;
};
