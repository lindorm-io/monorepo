import type { OpenIdScope } from "@lindorm/types";

export interface IPylonSession {
  id: string;
  accessToken: string;
  expiresAt: Date | null;
  idToken?: string;
  issuedAt: Date;
  refreshToken?: string;
  scope: Array<OpenIdScope | string>;
  subject: string;
}
