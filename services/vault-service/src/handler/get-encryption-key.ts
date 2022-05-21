import { ServerKoaContext } from "../types";
import { baseHash } from "@lindorm-io/core";

export const getEncryptionKey = (ctx: ServerKoaContext): string => {
  const {
    token: {
      bearerToken: { subject, subjectHint },
    },
  } = ctx;

  return baseHash(`${subjectHint}:${subject}`);
};
