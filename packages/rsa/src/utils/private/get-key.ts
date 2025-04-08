import { IKryptosRsa } from "@lindorm/kryptos";
import { DsaEncoding } from "@lindorm/types";
import { RSA_PKCS1_PSS_PADDING } from "constants";
import { SignPrivateKeyInput, VerifyPublicKeyInput } from "crypto";
import { RsaError } from "../../errors";

const RSA_PKCS1_SALT_LENGTH = 32 as const;

export const getSignKey = (
  kryptos: IKryptosRsa,
  dsaEncoding: DsaEncoding,
): SignPrivateKeyInput | string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new RsaError("Private key not found in key set", { debug: { kryptos } });
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

  throw new RsaError("Unsupported RSA algorithm", { debug: { kryptos } });
};

export const getVerifyKey = (
  kryptos: IKryptosRsa,
  dsaEncoding: DsaEncoding,
): VerifyPublicKeyInput | string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new RsaError("Public key not found in key set", { debug: { kryptos } });
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

  throw new RsaError("Unsupported RSA algorithm", { debug: { kryptos } });
};
