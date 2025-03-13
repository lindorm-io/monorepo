import { SetCookieOptions } from "./cookies";

export type PylonSessionStore = {
  setSession: (session: PylonSession) => Promise<string>;
  getSession: (id: string) => Promise<PylonSession | null>;
  delSession: (id: string) => Promise<void>;
};

export type PylonSession = {
  id: string;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
};

export type PylonSessionConfig = Omit<
  SetCookieOptions,
  "overwrite" | "path" | "priority"
> & {
  name?: string;
  store?: PylonSessionStore;
  verify?: boolean;
};
