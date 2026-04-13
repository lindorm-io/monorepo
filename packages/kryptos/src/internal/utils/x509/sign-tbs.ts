import { createPrivateKey, createSign, sign as cryptoSign, KeyObject } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosType } from "../../../types";
import { X509SignatureDescriptor } from "./encode-algorithm-identifier";

export type SignTbsOptions = {
  tbsBytes: Buffer;
  privateKey: Buffer;
  keyType: KryptosType;
  descriptor: X509SignatureDescriptor;
};

export const issuerPrivateKeyObject = (
  privateKey: Buffer,
  keyType: KryptosType,
): KeyObject => {
  if (keyType === "RSA") {
    return createPrivateKey({ key: privateKey, format: "der", type: "pkcs1" });
  }
  return createPrivateKey({ key: privateKey, format: "der", type: "pkcs8" });
};

export const detectOkpCurve = (
  privateKey: Buffer,
  keyType: KryptosType,
): "Ed25519" | "Ed448" | undefined => {
  if (keyType !== "OKP") return undefined;
  const obj = issuerPrivateKeyObject(privateKey, keyType);
  if (obj.asymmetricKeyType === "ed448") return "Ed448";
  if (obj.asymmetricKeyType === "ed25519") return "Ed25519";
  throw new KryptosError(
    `Unsupported OKP asymmetric key type for X.509 signing: ${obj.asymmetricKeyType}`,
  );
};

export const signX509Tbs = (options: SignTbsOptions): Buffer => {
  const { tbsBytes, privateKey, keyType, descriptor } = options;
  const keyObject = issuerPrivateKeyObject(privateKey, keyType);

  if (
    descriptor.nodeSignAlgorithm === "ed25519" ||
    descriptor.nodeSignAlgorithm === "ed448"
  ) {
    const signature = cryptoSign(null, tbsBytes, keyObject);
    if (!Buffer.isBuffer(signature)) {
      throw new KryptosError("EdDSA signing did not return a Buffer");
    }
    return signature;
  }

  if (descriptor.hashName === null) {
    throw new KryptosError("Missing hash name for hashing signature algorithm");
  }

  const signer = createSign(descriptor.hashName);
  signer.update(tbsBytes);
  const signature = signer.sign(keyObject);

  if (!Buffer.isBuffer(signature)) {
    throw new KryptosError("Signing did not return a Buffer");
  }

  return signature;
};
