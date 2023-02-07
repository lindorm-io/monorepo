export type VerifyAuthenticationRequestBody = {
  id: string;
  code: string;
  codeVerifier: string;
};

export type VerifyAuthenticationResponse = {
  authenticationConfirmationToken: string;
  expiresIn: number;
};
