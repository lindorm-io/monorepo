export interface IPylonSession {
  id: string;
  accessToken: string;
  expiresAt: Date | null;
  idToken?: string;
  issuedAt: Date;
  refreshToken?: string;
  /**
   * Whatever scopes the external IdP granted — read off its token response or
   * access token, never chosen by pylon. RFC 6749 §3.3 lets every deployment
   * define its own values, so this is not the `@lindorm/openid` vocabulary and
   * does not pretend to be. Matches the `Session` entity's string array column
   * and `IWebhookSubscription.scope`.
   */
  scope: Array<string>;
  subject: string;
}
