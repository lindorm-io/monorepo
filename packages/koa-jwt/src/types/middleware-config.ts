export interface TokenValidationMiddlewareConfig {
  clockTolerance?: number;
  contextKey: string;
  issuer: string;
  maxAge?: string;
  subjectHint?: string;
  types: Array<string>;
}
