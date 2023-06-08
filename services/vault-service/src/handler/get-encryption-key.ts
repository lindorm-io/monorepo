import { baseHash } from "@lindorm-io/core";
import { ServerKoaContext } from "../types";

export const getEncryptionKey = (ctx: ServerKoaContext): string => {
  const {
    token: {
      bearerToken: {
        metadata: { subjectHint },
        subject,
      },
    },
  } = ctx;

  return baseHash(`${subjectHint}:${subject}`);
};
