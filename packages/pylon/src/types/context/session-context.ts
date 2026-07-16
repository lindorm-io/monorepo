import type { IPylonSession } from "../../interfaces/index.js";

export type PylonSessionOnContext = {
  set(session: IPylonSession): Promise<void>;
  get(): Promise<IPylonSession | null>;
  del(): Promise<void>;
  logout(subject: string): Promise<void>;
};
