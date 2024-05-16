import { Kryptos } from "@lindorm/kryptos";
import { createPrivateKey, createPublicKey, diffieHellman } from "crypto";
import { AesError } from "../../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../../types";
import { _createKeyDerivation } from "./create-key-derivation";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: Kryptos;
};

type EncryptResult = {
  encryptionKey: Buffer;
  publicEncryptionJwk: PublicEncryptionJwk;
  salt: Buffer;
};

type DecryptOptions = {
  encryption: AesEncryption;
  kryptos: Kryptos;
  publicEncryptionJwk: PublicEncryptionJwk;
  salt: Buffer;
};

const _generateKryptos = (kryptos: Kryptos): Kryptos => {
  if (Kryptos.isEc(kryptos)) {
    return Kryptos.generate({ type: kryptos.type, use: "enc", curve: kryptos.curve });
  }

  if (Kryptos.isOkp(kryptos)) {
    return Kryptos.generate({ type: kryptos.type, use: "enc", curve: kryptos.curve });
  }

  throw new AesError("Invalid kryptos type");
};

export const _getDiffieHellmanEncryptionKey = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  const pek = _generateKryptos(kryptos);
  const der = kryptos.export("der");
  const sender = pek.export("der");

  const sharedSecret = diffieHellman({
    privateKey: createPrivateKey({
      key: sender.privateKey!,
      format: "der",
      type: "pkcs8",
    }),
    publicKey: createPublicKey({
      key: der.publicKey,
      format: "der",
      type: "spki",
    }),
  });

  const { encryptionKey, salt } = _createKeyDerivation({
    encryption,
    initialKeyMaterial: sharedSecret,
  });

  const { crv, kty, x, y } = pek.export("jwk");

  return {
    encryptionKey,
    publicEncryptionJwk: { crv, kty, x, y },
    salt,
  };
};

export const _getDiffieHellmanDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionJwk,
  salt,
}: DecryptOptions): Buffer => {
  const pek = Kryptos.from("jwk", { alg: "ECDH-ES", use: "enc", ...publicEncryptionJwk });
  const der = kryptos.export("der");
  const receiver = pek.export("der");

  const sharedSecret = diffieHellman({
    privateKey: createPrivateKey({
      key: der.privateKey!,
      format: "der",
      type: "pkcs8",
    }),
    publicKey: createPublicKey({
      key: receiver.publicKey,
      format: "der",
      type: "spki",
    }),
  });

  const { encryptionKey } = _createKeyDerivation({
    encryption,
    initialKeyMaterial: sharedSecret,
    salt,
  });

  return encryptionKey;
};
