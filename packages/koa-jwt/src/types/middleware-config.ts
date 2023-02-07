export type TokenValidationMiddlewareConfig = {
  audience?: string;
  clockTolerance?: number;
  contextKey: string;
  issuer: string;
  subjectHints?: string[];
  tenant?: string;
  types?: string[];
};
