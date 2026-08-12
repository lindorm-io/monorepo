import { B64 } from "@lindorm/b64";
import type { Dict } from "@lindorm/types";
import type { AegisClaimsWire } from "../../types/index.js";

type DecodeClaims<C extends Dict = Dict> = AegisClaimsWire & C;

export const decodeJwtPayload = <C extends Dict = Dict<never>>(
  payload: string,
): DecodeClaims<C> => JSON.parse(B64.toString(payload)) as DecodeClaims<C>;
