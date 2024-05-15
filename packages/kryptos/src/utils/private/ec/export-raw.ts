import { KryptosError } from "../../../errors";
import { EcRaw, KryptosDer } from "../../../types";
import { _exportEcToJwk } from "./export-jwk";
import { _isEcCurve } from "./is-ec-curve";

type Options = Omit<KryptosDer, "algorithm" | "type" | "use">;

type Result = Omit<EcRaw, "algorithm" | "type" | "use">;

export const _exportEcToRaw = (options: Options): Result => {
  if (!_isEcCurve(options.curve)) {
    throw new KryptosError("Curve is required");
  }

  const jwk = _exportEcToJwk({ ...options, mode: "private" });

  if (!jwk.x || !jwk.y) {
    throw new KryptosError("Key export failed");
  }

  const result: Result = {
    curve: options.curve,
    ...(jwk.d ? { privateKey: Buffer.from(jwk.d, "base64") } : {}),
    publicKey: Buffer.alloc(0),
  };

  result.publicKey = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(jwk.x, "base64"),
    Buffer.from(jwk.y, "base64"),
  ]);

  return result;
};
