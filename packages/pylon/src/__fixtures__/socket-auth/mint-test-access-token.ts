import type { IAegis, SignedJwt } from "@lindorm/aegis";
import { SOCKET_AUTH_TEST_ISSUER } from "./shared.js";

export type MintTestAccessTokenInput = {
  subject: string;
  expiresIn?: number;
  jkt?: string;
};

export type MintTestAccessTokenResult = {
  token: string;
  expiresIn: number;
  expiresAt: Date;
  signed: SignedJwt;
};

export const mintTestAccessToken = async (
  aegis: IAegis,
  input: MintTestAccessTokenInput,
): Promise<MintTestAccessTokenResult> => {
  const expiresIn = input.expiresIn ?? 3600;

  const signed = await aegis.mint("default", {
    audience: [SOCKET_AUTH_TEST_ISSUER],
    expires: `${expiresIn} seconds`,
    subject: input.subject,
    tokenType: "access_token",
    ...(input.jkt ? { confirmation: { thumbprint: input.jkt } } : {}),
  });

  return {
    token: signed.token,
    expiresIn,
    // The "default" profile always derives `exp` (and therefore expiresAt)
    // when `expires` is supplied, so this is non-null here.
    expiresAt: signed.expiresAt!,
    signed,
  };
};
