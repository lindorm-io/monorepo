export interface VerifyAuthenticationRequestData {
  id: string;
  code: string;
  codeVerifier: string;
}

export interface VerifyAuthenticationResponseBody {
  authenticationConfirmationToken: string;
  expiresIn: number;
}
