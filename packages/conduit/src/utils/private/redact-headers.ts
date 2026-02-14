import { Dict, Header } from "@lindorm/types";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
]);

export const redactHeaders = (headers: Dict<Header>): Dict<string> => {
  const result: Dict<string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const stringValue = String(value);
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? "[REDACTED]" : stringValue;
  }

  return result;
};
