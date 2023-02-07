export type BearerAuthMiddlewareConfig = {
  audience?: string;
  clockTolerance?: number;
  contextKey?: string;
  issuer: string;
  subjectHints?: string[];
  tenant?: string;
  types?: string[];
};
