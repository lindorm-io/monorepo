import { Dict } from "@lindorm/types";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
]);

export const redactHeaders = (headers: Dict<string>): Dict<string> => {
  const result: Dict<string> = {};

  for (const [key, value] of Object.entries(headers)) {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }

  return result;
};
