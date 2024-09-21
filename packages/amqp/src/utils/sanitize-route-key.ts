export const sanitizeRouteKey = (string: string): string =>
  string.replace(/[^a-z\d-_:.]/gi, "");
