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
        title: "AKP JWK Export Failed",
        details: "The exported private key JWK was missing its 'pub' component.",
      });
    }
    if (!jwk.priv) {
      throw new KryptosError("Key export failed [priv]: missing private key seed", {
        code: "akp_jwk_export_failed",
        title: "AKP JWK Export Failed",
        details: "The exported private key JWK was missing its 'priv' seed component.",
      });
    }

    result.pub = jwk.pub;
    result.priv = jwk.priv;
  }

  if (!result.pub.length) {
    if (!options.publicKey) {
      throw new KryptosError("Public key not available", {
        code: "missing_akp_key_material",
        title: "Missing AKP Key Material",
        details: "No private or public key was available to export to JWK.",
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
        title: "AKP JWK Export Failed",
        details: "The exported public key JWK was missing its 'pub' component.",
      });
    }

    result.pub = jwk.pub;
  }

  if (!result.pub.length) {
    throw new KryptosError("Key export failed: no public key available", {
      code: "missing_akp_key_material",
      title: "Missing AKP Key Material",
      details: "No public key was available to export to JWK.",
    });
  }

  return result;
};
