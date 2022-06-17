export interface TokenValidationMiddlewareConfig {
  audiences?: Array<string>;
  clockTolerance?: number;
  contextKey: string;
  issuer: string;
  subjectHint?: string;
  types: Array<string>;
}
