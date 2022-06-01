export interface InitialiseOidcSessionRequestData {
  callbackUri: string;
  expires: string;
  identityId?: string;
  loginHint?: string;
  provider: string;
}

export interface InitialiseOidcSessionResponseBody {
  redirectTo: string;
}
