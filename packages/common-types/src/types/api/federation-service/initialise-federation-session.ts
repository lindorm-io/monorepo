import { StandardResponseWithRedirectTo } from "../standard";

export type InitialiseFederationSessionRequestBody = {
  callbackId: string;
  callbackUri: string;
  expires: string;
  identityId?: string;
  loginHint?: string;
  provider: string;
};

export type InitialiseFederationSessionResponse = StandardResponseWithRedirectTo;
