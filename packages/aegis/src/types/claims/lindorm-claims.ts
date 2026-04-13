import { AdjustedAccessLevel, LevelOfAssurance } from "../level-of-assurance";

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
  adjustedAccessLevel?: AdjustedAccessLevel;
  authFactor?: Array<AuthFactor>;
  clientId?: string;
  grantType?: string;
  levelOfAssurance?: LevelOfAssurance;
  permissions?: Array<string>;
  scope?: Array<string>;
  sessionHint?: SessionHint;
  sessionId?: string;
  subjectHint?: SubjectHint;
  tenantId?: string;
};
