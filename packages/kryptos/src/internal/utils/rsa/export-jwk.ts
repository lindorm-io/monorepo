import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosExportMode, RsaJwk } from "../../../types/index.js";

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
      throw new KryptosError("Key export failed [e]: missing public exponent", {
        code: "rsa_jwk_export_failed",
        title: "RSA JWK Export Failed",
        details: "The exported RSA JWK is missing the public exponent component 'e'.",
        data: { component: "e" },
      });
    }
    if (!n) {
      throw new KryptosError("Key export failed [n]: missing modulus", {
        code: "rsa_jwk_export_failed",
        title: "RSA JWK Export Failed",
        details: "The exported RSA JWK is missing the modulus component 'n'.",
        data: { component: "n" },
      });
    }
    if (!d) {
      throw new KryptosError("Key export failed [d]: missing private exponent", {
        code: "rsa_jwk_export_failed",
        title: "RSA JWK Export Failed",
        details: "The exported RSA JWK is missing the private exponent component 'd'.",
        data: { component: "d" },
      });
    }
    if (!p) {
      throw new KryptosError("Key export failed [p]: missing first prime factor", {
        code: "rsa_jwk_export_failed",
        title: "RSA JWK Export Failed",
        details: "The exported RSA JWK is missing the first prime factor component 'p'.",
        data: { component: "p" },
      });
    }
    if (!q) {
      throw new KryptosError("Key export failed [q]: missing second prime factor", {
        code: "rsa_jwk_export_failed",
        title: "RSA JWK Export Failed",
        details: "The exported RSA JWK is missing the second prime factor component 'q'.",
        data: { component: "q" },
      });
    }
    if (!dp) {
      throw new KryptosError(
        "Key export failed [dp]: missing first factor CRT exponent",
        {
          code: "rsa_jwk_export_failed",
          title: "RSA JWK Export Failed",
          details:
            "The exported RSA JWK is missing the first factor CRT exponent component 'dp'.",
          data: { component: "dp" },
        },
      );
    }
    if (!dq) {
      throw new KryptosError(
        "Key export failed [dq]: missing second factor CRT exponent",
        {
          code: "rsa_jwk_export_failed",
          title: "RSA JWK Export Failed",
          details:
            "The exported RSA JWK is missing the second factor CRT exponent component 'dq'.",
          data: { component: "dq" },
        },
      );
    }
    if (!qi) {
      throw new KryptosError("Key export failed [qi]: missing first CRT coefficient", {
        code: "rsa_jwk_export_failed",
        title: "RSA JWK Export Failed",
        details:
          "The exported RSA JWK is missing the first CRT coefficient component 'qi'.",
        data: { component: "qi" },
      });
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
      throw new KryptosError("Public key is required", {
        code: "missing_rsa_public_key",
        title: "Missing RSA Public Key",
        details:
          "No RSA public key was supplied to derive the JWK public components 'e' and 'n'.",
      });
    }

    const keyObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "pkcs1",
    });
    const { e, n } = keyObject.export({ format: "jwk" });

    if (!e) {
      throw new KryptosError("Key export failed [e]: missing public exponent", {
        code: "rsa_jwk_export_failed",
        title: "RSA JWK Export Failed",
        details: "The exported RSA JWK is missing the public exponent component 'e'.",
        data: { component: "e" },
      });
    }
    if (!n) {
      throw new KryptosError("Key export failed [n]: missing modulus", {
        code: "rsa_jwk_export_failed",
        title: "RSA JWK Export Failed",
        details: "The exported RSA JWK is missing the modulus component 'n'.",
        data: { component: "n" },
      });
    }

    result.e = e;
    result.n = n;
  }

  if (!result.e.length || !result.n.length) {
    throw new KryptosError("Key export failed", {
      code: "rsa_jwk_export_failed",
      title: "RSA JWK Export Failed",
      details:
        "The exported RSA JWK is missing the required public components 'e' and 'n'.",
    });
  }

  return result;
};
