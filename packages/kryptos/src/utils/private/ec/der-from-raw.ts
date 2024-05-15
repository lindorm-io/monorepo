import { KryptosError } from "../../../errors";
import { EcDer, EcJwk, KryptosRaw } from "../../../types";
import { _getCurveLength } from "./curve-length";
import { _createEcDerFromJwk } from "./der-from-jwk";
import { _isEcCurve } from "./is-ec-curve";

type Options = Omit<KryptosRaw, "algorithm" | "type" | "use">;

type Jwk = Omit<EcJwk, "alg" | "use">;

type Result = Omit<EcDer, "algorithm" | "type" | "use">;

export const _createEcDerFromRaw = (options: Options): Result => {
  if (!_isEcCurve(options.curve)) {
    throw new KryptosError("Curve is required");
  }

  if (!options.publicKey) {
    throw new KryptosError("Public key is required");
  }

  const len = _getCurveLength(options.curve);

  const jwk: Jwk = {
    crv: options.curve,
    x: options.publicKey.subarray(-len, -len / 2).toString("base64"),
    y: options.publicKey.subarray(-len / 2).toString("base64"),
    kty: "EC",
  };

  if (options.privateKey) {
    jwk.d = options.privateKey.toString("base64");
  }

  return _createEcDerFromJwk(jwk);
};
