import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { AkpJwk, KryptosBuffer, KryptosExportMode } from "../../../types/index.js";

type Options = Omit<KryptosBuffer, "id" | "algorithm" | "type" | "use"> & {
  mode: KryptosExportMode;
};

type Result = Omit<AkpJwk, "kid" | "alg" | "kty" | "use">;

type NodeAkpJwk = {
  kty?: string;
  alg?: string;
  pub?: string;
  priv?: string;
};

export const exportAkpToJwk = (options: Options): Result => {
  const result: Result = {
    pub: "",
  };

  if (options.mode === "private" && options.privateKey) {
    const keyObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs8",
    });
    const jwk = keyObject.export({ format: "jwk" }) as NodeAkpJwk;

    if (!jwk.pub) {
      throw new KryptosError("Key export failed [pub]: missing public key component", {
        code: "akp_jwk_export_failed",
      });
    }
    if (!jwk.priv) {
      throw new KryptosError("Key export failed [priv]: missing private key seed", {
        code: "akp_jwk_export_failed",
      });
    }

    result.pub = jwk.pub;
    result.priv = jwk.priv;
  }

  if (!result.pub.length) {
    if (!options.publicKey) {
      throw new KryptosError("Public key not available", {
        code: "missing_akp_key_material",
      });
    }

    const keyObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "spki",
    });
    const jwk = keyObject.export({ format: "jwk" }) as NodeAkpJwk;

    if (!jwk.pub) {
      throw new KryptosError("Key export failed [pub]: missing public key component", {
        code: "akp_jwk_export_failed",
      });
    }

    result.pub = jwk.pub;
  }

  if (!result.pub.length) {
    throw new KryptosError("Key export failed: no public key available", {
      code: "missing_akp_key_material",
    });
  }

  return result;
};
