export interface InitialiseOidcSessionRequestData {
  callbackUri: string;
  expiresAt: string;
  identityId?: string;
  loginHint?: string;
  provider: string;
}

export interface InitialiseOidcSessionResponseBody {
  redirectTo: string;
}
