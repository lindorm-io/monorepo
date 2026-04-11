import { PylonCommonContext } from "../types";
import { IPylonSession } from "./PylonSession";

export interface IPylonSessionStore<C extends PylonCommonContext = PylonCommonContext> {
  set: (ctx: C, session: IPylonSession) => Promise<string>;
  get: (ctx: C, id: string) => Promise<IPylonSession | null>;
  del: (ctx: C, id: string) => Promise<void>;
  logout: (ctx: C, subject: string) => Promise<void>;
}
