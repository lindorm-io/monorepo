import { Kryptos } from "@lindorm/kryptos";
import { hash, verify } from "argon2";
import { ArgonError } from "../../errors";
import { CreateArgonHashOptions, VerifyArgonHashOptions } from "../../types";

const _getSecret = (kryptos?: Kryptos): Buffer | undefined => {
  if (!kryptos) return;

  if (!Kryptos.isOct(kryptos)) {
    throw new ArgonError("Invalid Kryptos");
  }

  const { privateKey } = kryptos.export("der");

  if (!privateKey) {
    throw new ArgonError("Invalid Kryptos");
  }

  return privateKey;
};

export const _createArgonHash = async ({
  data,
  hashLength = 256,
  kryptos,
  memoryCost = 65536,
  parallelism = 8,
  timeCost = 12,
}: CreateArgonHashOptions): Promise<string> => {
  const secret = _getSecret(kryptos);

  return await hash(data, {
    hashLength,
    memoryCost,
    parallelism,
    timeCost,
    ...(secret && { secret }),
  });
};

export const _verifyArgonHash = async ({
  data,
  hash,
  kryptos,
}: VerifyArgonHashOptions): Promise<boolean> => {
  const secret = _getSecret(kryptos);

  return await verify(hash, data, secret ? { secret } : undefined);
};

export const _assertArgonHash = async (options: VerifyArgonHashOptions): Promise<void> => {
  if (await _verifyArgonHash(options)) return;
  throw new ArgonError("Invalid Argon hash");
};
