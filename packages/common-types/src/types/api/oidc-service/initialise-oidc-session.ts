import { StandardResponseWithRedirectTo } from "../standard";

export type InitialiseOidcSessionRequestBody = {
  callbackId: string;
  callbackUri: string;
  expiresAt: string;
  identityId?: string;
  loginHint?: string;
  provider: string;
};

export type InitialiseOidcSessionResponse = StandardResponseWithRedirectTo;
