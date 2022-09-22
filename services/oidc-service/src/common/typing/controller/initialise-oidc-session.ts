export interface InitialiseOidcSessionRequestData {
  callbackId: string;
  callbackUri: string;
  expiresAt: string;
  identityId?: string;
  loginHint?: string;
  provider: string;
}

export interface InitialiseOidcSessionResponseBody {
  redirectTo: string;
}
