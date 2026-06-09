import type { IKryptosRsa } from "@lindorm/kryptos";
import type { DsaEncoding } from "@lindorm/types";
import { RSA_PKCS1_PSS_PADDING } from "constants";
import type { SignPrivateKeyInput, VerifyPublicKeyInput } from "crypto";
import { RsaError } from "../errors/index.js";

const RSA_PKCS1_SALT_LENGTH = 32 as const;

export const getSignKey = (
  kryptos: IKryptosRsa,
  dsaEncoding: DsaEncoding,
): SignPrivateKeyInput | string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new RsaError("Private key not found in key set", {
      code: "private_key_not_found",
      title: "Private Key Not Found",
      details: "The RSA key set does not contain a private key required for signing.",
      data: { algorithm: kryptos.algorithm },
      debug: { id: kryptos.id },
    });
  }

  if (kryptos.algorithm.startsWith("PS")) {
    return {
      key: privateKey,
      padding: RSA_PKCS1_PSS_PADDING,
      saltLength: RSA_PKCS1_SALT_LENGTH,
      dsaEncoding,
    };
  }

  if (kryptos.algorithm.startsWith("RS")) {
    return { key: privateKey, dsaEncoding };
  }

  throw new RsaError("Unsupported RSA algorithm", {
    code: "unsupported_algorithm",
    title: "Unsupported Algorithm",
    details:
      "The RSA key algorithm is not a recognised signing algorithm; expected an RS or PS prefixed algorithm.",
    data: { algorithm: kryptos.algorithm },
    debug: { id: kryptos.id },
  });
};

export const getVerifyKey = (
  kryptos: IKryptosRsa,
  dsaEncoding: DsaEncoding,
): VerifyPublicKeyInput | string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new RsaError("Public key not found in key set", {
      code: "public_key_not_found",
      title: "Public Key Not Found",
      details: "The RSA key set does not contain a public key required for verification.",
      data: { algorithm: kryptos.algorithm },
      debug: { id: kryptos.id },
    });
  }

  if (kryptos.algorithm.startsWith("PS")) {
    return {
      key: publicKey,
      padding: RSA_PKCS1_PSS_PADDING,
      saltLength: RSA_PKCS1_SALT_LENGTH,
      dsaEncoding,
    };
  }

  if (kryptos.algorithm.startsWith("RS")) {
    return { key: publicKey, dsaEncoding };
  }

  throw new RsaError("Unsupported RSA algorithm", {
    code: "unsupported_algorithm",
    title: "Unsupported Algorithm",
    details:
      "The RSA key algorithm is not a recognised signing algorithm; expected an RS or PS prefixed algorithm.",
    data: { algorithm: kryptos.algorithm },
    debug: { id: kryptos.id },
  });
};
