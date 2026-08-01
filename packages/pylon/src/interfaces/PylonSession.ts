import type { Scope } from "@lindorm/openid";

export interface IPylonSession {
  id: string;
  accessToken: string;
  expiresAt: Date | null;
  idToken?: string;
  issuedAt: Date;
  refreshToken?: string;
  scope: Array<Scope>;
  subject: string;
}
