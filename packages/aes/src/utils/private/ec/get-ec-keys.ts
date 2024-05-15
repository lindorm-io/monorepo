import { EcCurve, EcJwk, Kryptos, KryptosEc } from "@lindorm/kryptos";
import { createECDH } from "crypto";
import { AesError } from "../../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../../types";
import { _createKeyDerivation } from "../secret/create-key-derivation";
import { _getKeyCurve, _getNistCurve } from "./get-key-curve";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: KryptosEc;
};

type EncryptResult = {
  encryptionKey: Buffer;
  publicEncryptionJwk: PublicEncryptionJwk;
};

type DecryptOptions = {
  encryption: AesEncryption;
  kryptos: KryptosEc;
  publicEncryptionJwk: PublicEncryptionJwk;
};

export const _getEcEncryptionKeys = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  if (!Kryptos.isEc(kryptos)) {
    throw new AesError("Invalid kryptos type", {
      debug: { kryptos },
    });
  }

  const exported = kryptos.export("raw");
  const curve = exported.curve as EcCurve;
  const publicKey = exported.publicKey;

  if (!publicKey) {
    throw new AesError("Missing public key");
  }
  if (!curve) {
    throw new AesError("Missing curve");
  }

  const senderKeyPair = createECDH(_getKeyCurve(curve));
  const senderPublicKey = senderKeyPair.generateKeys();
  const sharedSecret = senderKeyPair.computeSecret(publicKey);
  const encryptionKey = _createKeyDerivation({
    encryption,
    initialKeyringMaterial: sharedSecret,
  });

  const publicEncryptionKryptos = Kryptos.from("raw", {
    algorithm: "ECDH-ES",
    curve: _getNistCurve(curve),
    publicKey: senderPublicKey,
    type: "EC",
    use: "enc",
  });

  const { crv, kty, x, y } = publicEncryptionKryptos.export<EcJwk>("jwk");

  return { encryptionKey, publicEncryptionJwk: { crv, kty, x, y } };
};

export const _getEcDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionJwk,
}: DecryptOptions): Buffer => {
  if (!Kryptos.isEc(kryptos)) {
    throw new AesError("Invalid kryptos type", {
      debug: { kryptos },
    });
  }

  const exported = kryptos.export("raw");
  const curve = exported.curve as EcCurve;
  const privateKey = exported.privateKey;

  if (!privateKey) {
    throw new AesError("Missing private key");
  }
  if (!curve) {
    throw new AesError("Missing curve");
  }

  const receiverKeyPair = createECDH(_getKeyCurve(curve));
  receiverKeyPair.setPrivateKey(privateKey);

  const publicEncryptionKryptos = Kryptos.from("jwk", {
    ...publicEncryptionJwk,
    alg: "ECDH-ES",
    use: "enc",
  });
  const { publicKey } = publicEncryptionKryptos.export("raw");

  if (!publicKey) {
    throw new AesError("Missing public key");
  }

  const sharedSecret = receiverKeyPair.computeSecret(publicKey);

  return _createKeyDerivation({ encryption, initialKeyringMaterial: sharedSecret });
};
