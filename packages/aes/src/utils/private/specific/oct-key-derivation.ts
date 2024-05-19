import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
} from "../../../types/private";
import { _calculateEncryptionKeyLength } from "./calculate-encryption-key-length";
import { _calculateOctKeyDerivation } from "./calculate-oct-key-derivation";
import { _hkdf } from "./hkdf";
import { _pbkdf } from "./pbkdf";

type CreateResult = Omit<
  CreateCekResult,
  "contentEncryptionKey" | "publicEncryptionKey"
> & {
  derivedKey: Buffer;
};

type DecryptOptions = Omit<
  DecryptCekOptions,
  "publicEncryptionJwk" | "publicEncryptionKey"
>;

type DecryptResult = {
  derivedKey: Buffer;
};

export const _createOctKeyDerivation = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");
  const keyLength = _calculateEncryptionKeyLength(encryption);
  const derivation = _calculateOctKeyDerivation(kryptos.algorithm, der.privateKey);

  if (derivation === "hkdf") {
    const { derivedKey, hkdfSalt } = _hkdf({
      derivationKey: der.privateKey,
      keyLength,
    });

    return { derivedKey, hkdfSalt };
  }

  const { derivedKey, pbkdfIterations, pbkdfSalt } = _pbkdf({
    derivationKey: der.privateKey,
    keyLength,
  });

  return { derivedKey, pbkdfIterations, pbkdfSalt };
};

export const _decryptOctKeyDerivation = ({
  encryption,
  hkdfSalt,
  kryptos,
  pbkdfIterations,
  pbkdfSalt,
}: DecryptOptions): DecryptResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");
  const keyLength = _calculateEncryptionKeyLength(encryption);
  const derivation = _calculateOctKeyDerivation(kryptos.algorithm, der.privateKey);

  if (derivation === "hkdf") {
    const { derivedKey } = _hkdf({
      derivationKey: der.privateKey,
      hkdfSalt,
      keyLength,
    });

    return { derivedKey };
  }

  const { derivedKey } = _pbkdf({
    derivationKey: der.privateKey,
    keyLength,
    pbkdfIterations,
    pbkdfSalt,
  });

  return { derivedKey };
};
