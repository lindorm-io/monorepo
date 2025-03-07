import { Expiry } from "@lindorm/date";
import { CookieSameSite } from "./cookies";

export type PylonSession = {
  id: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
};

export type PylonSessionConfig = {
  name?: string;
  expiry?: Expiry;
  httpOnly?: boolean;
  sameSite?: CookieSameSite;
};
