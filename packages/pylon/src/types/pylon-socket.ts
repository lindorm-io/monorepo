import { ParsedJws, ParsedJwt } from "@lindorm/aegis";
import { Dict } from "@lindorm/types";
import { AppState } from "./context-common";
import { IoSocket } from "./socket";

export type PylonListenerMethod =
  | "on"
  | "onAny"
  | "onAnyOutgoing"
  | "once"
  | "prependAny"
  | "prependAnyOutgoing";

export type PylonSocketData = {
  app: AppState;
  tokens: Dict<ParsedJwt | ParsedJws<any>>;
};

export type PylonSocket<D extends PylonSocketData = PylonSocketData> = IoSocket<D>;
