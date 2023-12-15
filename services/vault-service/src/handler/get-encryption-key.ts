import { ClientError } from "@lindorm-io/errors";
import { randomBytes } from "crypto";
import { EncryptionKey } from "../entity";
import { aesCipher } from "../instance";
import { ServerKoaContext } from "../types";

export const getEncryptionKey = async (ctx: ServerKoaContext): Promise<string> => {
  const {
    mongo: { encryptionKeyRepository },
    token: {
      bearerToken: {
        metadata: { subjectHint },
        subject,
      },
    },
  } = ctx;

  if (!subjectHint) {
    throw new ClientError("Invalid token", {
      description: "Token must contain a subject hint",
    });
  }

  const found = await encryptionKeyRepository.tryFind({ owner: subject, ownerType: subjectHint });

  if (found) {
    return aesCipher.decrypt(found.key);
  }

  const key = randomBytes(16).toString("hex");

  await encryptionKeyRepository.create(
    new EncryptionKey({
      owner: subject,
      key: aesCipher.encrypt(key),
      ownerType: subjectHint,
    }),
  );

  return key;
};
