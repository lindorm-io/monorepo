import type { IAegis, SignedToken } from "@lindorm/aegis";
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
  signed: SignedToken;
};

export const mintTestAccessToken = async (
  aegis: IAegis,
  input: MintTestAccessTokenInput,
): Promise<MintTestAccessTokenResult> => {
  const expiresIn = input.expiresIn ?? 3600;

  // Minted under the `access_token` PROFILE, because that is what
  // `useAccessToken` verifies against (RFC 9068). The `default` profile stamps
  // no `at+jwt` typ and requires no `client_id`, so a token from it is refused
  // by the profile floor — an e2e suite minting one would be testing a
  // credential no deployment can present.
  //
  // `aud` is the socket-auth pylon's own issuer: this fixture deployment mints
  // the tokens it verifies, so its resource identity IS its issuer, and the
  // mounts state the same constant as their `audience`.
  const signed = await aegis.mint("access_token", {
    audience: [SOCKET_AUTH_TEST_ISSUER],
    clientId: "socket-auth-test-client",
    expires: `${expiresIn} seconds`,
    subject: input.subject,
    ...(input.jkt ? { confirmation: { thumbprint: input.jkt } } : {}),
  });

  return {
    token: signed.token,
    expiresIn,
    // `expires` is always supplied above, so `exp` — and therefore expiresAt —
    // is always derived here.
    expiresAt: signed.expiresAt!,
    signed,
  };
};
