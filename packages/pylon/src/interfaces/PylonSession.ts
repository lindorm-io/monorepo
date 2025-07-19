import { OpenIdScope } from "@lindorm/types";

export interface IPylonSession {
  id: string;
  accessToken: string;
  expiresAt: number;
  idToken?: string;
  issuedAt: number;
  refreshToken?: string;
  scope: Array<OpenIdScope | string>;
  subject: string;
}
