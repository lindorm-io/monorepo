import { PylonSetCookie } from "./cookies";

export type PylonSessionStore = {
  set: (session: PylonSession) => Promise<string>;
  get: (id: string) => Promise<PylonSession | null>;
  del: (id: string) => Promise<void>;
};

export type PylonSession = {
  id: string;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
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
  verify?: boolean;
};
