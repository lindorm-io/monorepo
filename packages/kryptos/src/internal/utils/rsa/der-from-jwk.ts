import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromJwk, RsaBuffer } from "../../../types/index.js";

type Options = Omit<KryptosFromJwk, "kid" | "alg" | "use">;

type Result = Omit<RsaBuffer, "id" | "algorithm" | "type" | "use">;

export const createRsaDerFromJwk = (options: Options): Result => {
  const result: Result = {
    publicKey: Buffer.alloc(0),
  };

  if (options.d && options.dp && options.dq && options.p && options.q && options.qi) {
    const privateObject = createPrivateKey({
      key: options,
      format: "jwk",
      type: "pkcs1",
    });
    const privateKey = privateObject.export({ format: "der", type: "pkcs1" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed", {
        code: "rsa_key_creation_failed",
        title: "RSA Key Creation Failed",
        details: "Converting the RSA private JWK to PKCS#1 DER did not produce a buffer.",
        data: { component: "private" },
      });
    }

    result.privateKey = privateKey;
  }

  if (options.e && options.n) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed", {
        code: "rsa_key_creation_failed",
        title: "RSA Key Creation Failed",
        details: "Converting the RSA public JWK to PKCS#1 DER did not produce a buffer.",
        data: { component: "public" },
      });
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey.length) {
    throw new KryptosError("Key creation failed", {
      code: "rsa_key_creation_failed",
      title: "RSA Key Creation Failed",
      details:
        "The RSA JWK did not contain a complete private or public key to convert to DER.",
    });
  }

  return result;
};
