import { OpenIdScope } from "@lindorm/types";
import { PylonSetCookie } from "./cookies";

export type PylonSessionStore = {
  set: (session: PylonSession) => Promise<string>;
  get: (id: string) => Promise<PylonSession | null>;
  del: (id: string) => Promise<void>;
  logout: (subject: string) => Promise<void>;
};

export type PylonSession = {
  id: string;
  accessToken: string;
  expiresAt: number;
  idToken?: string;
  issuedAt: number;
  refreshToken?: string;
  scope: Array<OpenIdScope | string>;
  subject: string;
};

export type PylonSessionConfig = Pick<
  PylonSetCookie,
  | "domain"
  | "encoding"
  | "encrypted"
  | "expiry"
  | "httpOnly"
  | "path"
  | "priority"
  | "sameSite"
  | "secure"
  | "signed"
> & {
  name?: string;
  store?: PylonSessionStore;
};
