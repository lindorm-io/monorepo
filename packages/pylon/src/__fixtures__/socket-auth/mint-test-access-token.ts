import { IAegis, SignedJwt } from "@lindorm/aegis";
import { SOCKET_AUTH_TEST_ISSUER } from "./shared";

export type MintTestAccessTokenInput = {
  subject: string;
  expiresIn?: number;
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

  const signed = await aegis.jwt.sign({
    audience: [SOCKET_AUTH_TEST_ISSUER],
    expires: `${expiresIn} seconds`,
    subject: input.subject,
    tokenType: "access_token",
  });

  return {
    token: signed.token,
    expiresIn,
    expiresAt: signed.expiresAt,
    signed,
  };
};
