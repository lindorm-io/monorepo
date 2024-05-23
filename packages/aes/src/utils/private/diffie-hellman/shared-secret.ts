import { IKryptos, Kryptos } from "@lindorm/kryptos";
import { createPrivateKey, createPublicKey, diffieHellman } from "crypto";
import { AesError } from "../../../errors";
import { PublicEncryptionJwk } from "../../../types";
import { DecryptCekOptions } from "../../../types/private";

type GenerateResult = {
  publicEncryptionJwk: PublicEncryptionJwk;
  sharedSecret: Buffer;
};

type CalculateSharedSecretOptions = Pick<
  DecryptCekOptions,
  "kryptos" | "publicEncryptionJwk"
>;

const generateKryptos = (kryptos: IKryptos): IKryptos => {
  if (!Kryptos.isEc(kryptos) && !Kryptos.isOkp(kryptos)) {
    throw new AesError("Invalid kryptos type");
  }

  return Kryptos.generate({
    algorithm: kryptos.algorithm,
    curve: kryptos.curve,
    type: kryptos.type,
    use: "enc",
  } as any);
};

export const generateSharedSecret = (kryptos: IKryptos): GenerateResult => {
  const pek = generateKryptos(kryptos);
  const der = kryptos.export("der");
  const sender = pek.export("der");

  if (!sender.privateKey) {
    throw new AesError("Sender private key is missing");
  }

  const sharedSecret = diffieHellman({
    privateKey: createPrivateKey({
      key: sender.privateKey,
      format: "der",
      type: "pkcs8",
    }),
    publicKey: createPublicKey({
      key: der.publicKey,
      format: "der",
      type: "spki",
    }),
  });

  const { crv, kty, x, y } = pek.export("jwk");

  return {
    publicEncryptionJwk: { crv, kty, x, y },
    sharedSecret,
  };
};

export const calculateSharedSecret = ({
  kryptos,
  publicEncryptionJwk,
}: CalculateSharedSecretOptions): Buffer => {
  if (!publicEncryptionJwk) {
    throw new AesError("Missing publicEncryptionJwk");
  }

  const pek = Kryptos.from("jwk", { alg: "ECDH-ES", use: "enc", ...publicEncryptionJwk });
  const der = kryptos.export("der");
  const receiver = pek.export("der");

  if (!der.privateKey) {
    throw new AesError("Kryptos private key is missing");
  }

  return diffieHellman({
    privateKey: createPrivateKey({
      key: der.privateKey,
      format: "der",
      type: "pkcs8",
    }),
    publicKey: createPublicKey({
      key: receiver.publicKey,
      format: "der",
      type: "spki",
    }),
  });
};
