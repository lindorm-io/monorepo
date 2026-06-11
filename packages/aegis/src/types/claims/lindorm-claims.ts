import type { OpenIdGrantType, OpenIdScope } from "@lindorm/types";
import type { LevelOfAssurance } from "../level-of-assurance.js";

export type AuthFactor = "knowledge" | "possession" | "inherence" | (string & {});

export type SessionHint =
  | "web"
  | "mobile"
  | "cli"
  | "service"
  | "machine"
  | (string & {});

export type SubjectHint = "user" | "client" | "service" | "device" | (string & {});

// Lindorm-proprietary claims, domain form.
export type LindormClaims = {
  authFactor?: Array<AuthFactor>;
  clientId?: string;
  grantType?: OpenIdGrantType;
  levelOfAssurance?: LevelOfAssurance;
  permissions?: Array<string>;
  scope?: Array<OpenIdScope>;
  sessionHint?: SessionHint;
  sessionId?: string;
  subjectHint?: SubjectHint;
  tenantId?: string;
};
