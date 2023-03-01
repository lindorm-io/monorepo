import { StandardRequestParamsWithId } from "../../standard";

export type VerifyAuthenticationRequestParams = StandardRequestParamsWithId;

export type VerifyAuthenticationRequestBody = {
  code: string;
  codeVerifier: string;
};

export type VerifyAuthenticationResponse = {
  authenticationConfirmationToken: string;
  expiresIn: number;
};
