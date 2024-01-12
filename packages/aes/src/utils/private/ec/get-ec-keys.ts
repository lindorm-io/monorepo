import { EcKeySet } from "@lindorm-io/jwk";
import { createECDH } from "crypto";
import { AesError } from "../../../errors";
import { Encryption, EncryptionKeyAlgorithm, PublicEncryptionJwk } from "../../../types";
import { createKeyDerivation } from "../secret";
import { getKeyCurve, getNistCurve } from "./get-key-curve";

type EncryptOptions = {
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  keySet: EcKeySet;
};

type EncryptResult = {
  encryptionKey: Buffer;
  publicEncryptionJwk: PublicEncryptionJwk;
};

type DecryptOptions = {
  encryption: Encryption;
  keySet: EcKeySet;
  publicEncryptionJwk: PublicEncryptionJwk;
};

export const getEcEncryptionKeys = ({
  encryption,
  encryptionKeyAlgorithm,
  keySet,
}: EncryptOptions): EncryptResult => {
  if (encryptionKeyAlgorithm !== "ECDH-ES") {
    throw new AesError("Mismatched options values", {
      description: "Encryption key algorithm is not ECDH_ES",
      debug: { encryptionKeyAlgorithm, keySet },
    });
  }

  const { id, publicKey } = keySet.export("raw");
  const senderKeyPair = createECDH(getKeyCurve(keySet.curve));
  const senderPublicKey = senderKeyPair.generateKeys();
  const sharedSecret = senderKeyPair.computeSecret(publicKey);
  const encryptionKey = createKeyDerivation({ encryption, initialKeyringMaterial: sharedSecret });

  const publicEncryptionKeySet = EcKeySet.fromRaw({
    id,
    curve: getNistCurve(keySet.curve),
    publicKey: senderPublicKey,
    type: "EC",
  });

  const { crv, kty, x, y } = publicEncryptionKeySet.export("jwk");

  return { encryptionKey, publicEncryptionJwk: { crv, kty, x, y } };
};

export const getEcDecryptionKey = ({
  encryption,
  keySet,
  publicEncryptionJwk,
}: DecryptOptions): Buffer => {
  const { privateKey } = keySet.export("raw");

  if (!privateKey) {
    throw new AesError("Missing private key", {
      debug: { keySet },
    });
  }

  const receiverKeyPair = createECDH(getKeyCurve(keySet.curve));
  receiverKeyPair.setPrivateKey(privateKey);

  const publicEncryptionKeySet = EcKeySet.fromJwk({ ...publicEncryptionJwk, kid: "ignored" });
  const { publicKey } = publicEncryptionKeySet.export("raw");
  const sharedSecret = receiverKeyPair.computeSecret(publicKey);

  return createKeyDerivation({ encryption, initialKeyringMaterial: sharedSecret });
};
