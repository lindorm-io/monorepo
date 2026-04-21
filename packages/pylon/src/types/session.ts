import type { IPylonSession } from "../interfaces/index.js";
import type { PylonSetCookie } from "./cookies.js";

export type PylonSessionOnContext = {
  set(session: IPylonSession): Promise<void>;
  get(): Promise<IPylonSession | null>;
  del(): Promise<void>;
  logout(subject: string): Promise<void>;
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
};
