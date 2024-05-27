import { VerifiedJws, VerifiedJwt } from "@lindorm/aegis";
import { Dict } from "@lindorm/types";
import { IoSocket } from "./socket";

export type PylonListenerMethod =
  | "on"
  | "onAny"
  | "onAnyOutgoing"
  | "once"
  | "prependAny"
  | "prependAnyOutgoing";

export type PylonSocketData = {
  tokens: Dict<VerifiedJwt | VerifiedJws<any>>;
};

export type PylonSocket<D extends PylonSocketData = PylonSocketData> = IoSocket<D>;
