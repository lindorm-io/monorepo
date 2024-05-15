import { KryptosRsa } from "@lindorm/kryptos";
import { SignPrivateKeyInput, VerifyPublicKeyInput } from "crypto";
import { RsaError } from "../../errors";

export const _getSignKey = (kryptos: KryptosRsa): SignPrivateKeyInput | string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new RsaError("Private key not found in key set", { debug: { kryptos } });
  }

  if (kryptos.algorithm.startsWith("PS")) {
    return {
      key: privateKey,
      padding: 1,
      saltLength: 32,
    };
  }

  if (kryptos.algorithm.startsWith("RS")) {
    return privateKey;
  }

  throw new RsaError("Unsupported RSA algorithm", { debug: { kryptos } });
};

export const _getVerifyKey = (kryptos: KryptosRsa): VerifyPublicKeyInput | string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new RsaError("Public key not found in key set", { debug: { kryptos } });
  }

  if (kryptos.algorithm.startsWith("PS")) {
    return {
      key: publicKey,
      padding: 1,
      saltLength: 32,
    };
  }

  if (kryptos.algorithm.startsWith("RS")) {
    return publicKey;
  }

  throw new RsaError("Unsupported RSA algorithm", { debug: { kryptos } });
};
