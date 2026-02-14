import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosBuffer, KryptosExportMode, RsaJwk } from "../../../types";

type Options = Omit<KryptosBuffer, "id" | "algorithm" | "type" | "use"> & {
  mode: KryptosExportMode;
};

type Result = Omit<RsaJwk, "kid" | "alg" | "kty" | "use">;

export const exportRsaToJwk = (options: Options): Result => {
  const result: Result = {
    e: "",
    n: "",
  };

  if (options.mode === "private" && options.privateKey) {
    const keyObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs1",
    });
    const { n, e, d, p, q, dp, dq, qi } = keyObject.export({ format: "jwk" });

    if (!e) {
      throw new KryptosError("Key export failed [e]: missing public exponent");
    }
    if (!n) {
      throw new KryptosError("Key export failed [n]: missing modulus");
    }
    if (!d) {
      throw new KryptosError("Key export failed [d]: missing private exponent");
    }
    if (!p) {
      throw new KryptosError("Key export failed [p]: missing first prime factor");
    }
    if (!q) {
      throw new KryptosError("Key export failed [q]: missing second prime factor");
    }
    if (!dp) {
      throw new KryptosError("Key export failed [dp]: missing first factor CRT exponent");
    }
    if (!dq) {
      throw new KryptosError(
        "Key export failed [dq]: missing second factor CRT exponent",
      );
    }
    if (!qi) {
      throw new KryptosError("Key export failed [qi]: missing first CRT coefficient");
    }

    result.e = e;
    result.n = n;
    result.d = d;
    result.p = p;
    result.q = q;
    result.dp = dp;
    result.dq = dq;
    result.qi = qi;
  }

  if (!result.e.length && !result.n.length) {
    if (!options.publicKey) {
      throw new KryptosError("Public key is required");
    }

    const keyObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "pkcs1",
    });
    const { e, n } = keyObject.export({ format: "jwk" });

    if (!e) {
      throw new KryptosError("Key export failed [e]: missing public exponent");
    }
    if (!n) {
      throw new KryptosError("Key export failed [n]: missing modulus");
    }

    result.e = e;
    result.n = n;
  }

  if (!result.e.length || !result.n.length) {
    throw new KryptosError("Key export failed");
  }

  return result;
};
