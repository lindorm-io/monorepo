import { OpenIdTokenRequestBody, OpenIdTokenResponseBody } from "../../../open-id";

export type TokenRequestBody = OpenIdTokenRequestBody & {
  authenticationToken?: string;
};

export type TokenResponse = OpenIdTokenResponseBody;
