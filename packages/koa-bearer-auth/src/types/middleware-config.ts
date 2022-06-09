export interface BearerAuthMiddlewareConfig {
  adjustedAccessLevel?: number;
  clockTolerance?: number;
  contextKey?: string;
  issuer: string;
  levelOfAssurance?: number;
  maxAge?: string;
  subjectHint?: string;
  types?: Array<string>;
}
