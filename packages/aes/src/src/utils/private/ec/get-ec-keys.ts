import { EcKeyJwk, Kryptos } from "@lindorm/kryptos";
import { createECDH } from "crypto";
import { AesError } from "../../../errors";
import { Encryption, EncryptionKeyAlgorithm, PublicEncryptionJwk } from "../../../types";
import { _createKeyDerivation } from "../secret/create-key-derivation";
import { _getKeyCurve, _getNistCurve } from "./get-key-curve";

type EncryptOptions = {
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  kryptos: Kryptos;
};

type EncryptResult = {
  encryptionKey: Buffer;
  publicEncryptionJwk: PublicEncryptionJwk;
};

type DecryptOptions = {
  encryption: Encryption;
  kryptos: Kryptos;
  publicEncryptionJwk: PublicEncryptionJwk;
};

export const _getEcEncryptionKeys = ({
  encryption,
  encryptionKeyAlgorithm,
  kryptos,
}: EncryptOptions): EncryptResult => {
  if (encryptionKeyAlgorithm !== "ECDH-ES") {
    throw new AesError("Mismatched options values", {
      debug: { encryptionKeyAlgorithm, kryptos },
    });
  }

  const { curve, publicKey } = kryptos.export("raw");

  if (!publicKey) {
    throw new AesError("Missing public key");
  }
  if (!curve) {
    throw new AesError("Missing curve");
  }

  const senderKeyPair = createECDH(_getKeyCurve(curve));
  const senderPublicKey = senderKeyPair.generateKeys();
  const sharedSecret = senderKeyPair.computeSecret(publicKey);
  const encryptionKey = _createKeyDerivation({ encryption, initialKeyringMaterial: sharedSecret });

  const publicEncryptionKryptos = Kryptos.from("raw", {
    id: kryptos.id,
    curve: _getNistCurve(curve),
    publicKey: senderPublicKey,
    type: "EC",
  });

  const { crv, kty, x, y } = publicEncryptionKryptos.export<EcKeyJwk>("jwk");

  return { encryptionKey, publicEncryptionJwk: { crv, kty, x, y } };
};

export const _getEcDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionJwk,
}: DecryptOptions): Buffer => {
  const { curve, privateKey } = kryptos.export("raw");

  if (!privateKey) {
    throw new AesError("Missing private key");
  }
  if (!curve) {
    throw new AesError("Missing curve");
  }

  const receiverKeyPair = createECDH(_getKeyCurve(curve));
  receiverKeyPair.setPrivateKey(privateKey);

  const publicEncryptionKryptos = Kryptos.from("jwk", publicEncryptionJwk);
  const { publicKey } = publicEncryptionKryptos.export("raw");

  if (!publicKey) {
    throw new AesError("Missing public key");
  }

  const sharedSecret = receiverKeyPair.computeSecret(publicKey);

  return _createKeyDerivation({ encryption, initialKeyringMaterial: sharedSecret });
};
