import { PylonSession, PylonSessionStore } from "../types";

export interface IPylonSession {
  set(session: PylonSession): Promise<void>;
  get(): Promise<PylonSession | null>;
  del(): Promise<void>;
  store?: PylonSessionStore;
}
