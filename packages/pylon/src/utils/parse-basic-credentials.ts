import { B64 } from "@lindorm/b64";

export type BasicCredentials = {
  username: string;
  password: string;
};

/**
 * Percent-decodes one half of a Basic credential.
 *
 * RFC 6749 Section 2.3.1: an OAuth client sending its credentials in the Authorization
 * header form-urlencodes `client_id` and `client_secret` before base64 encoding them, so
 * each half must be decoded independently.
 *
 * A plain (non-OAuth) RFC 7617 password may legitimately contain a bare `%`, which is not
 * valid percent-encoding and makes `decodeURIComponent` throw. Such a half is kept verbatim
 * rather than rejected.
 */
const decodeComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Parses the base64 credential of a `Basic` authorization header.
 *
 * RFC 7617: the username may not contain a colon, but the password may — so the split is on
 * the FIRST colon only and the entire remainder is the password.
 *
 * Returns `null` when the value is not valid base64, or when the decoded credential is not in
 * `username:password` form. A malformed header is a client error, not a server error.
 */
export const parseBasicCredentials = (value: string): BasicCredentials | null => {
  let decoded: string;

  try {
    decoded = B64.toString(value);
  } catch {
    return null;
  }

  const index = decoded.indexOf(":");

  if (index < 0) return null;

  return {
    username: decodeComponent(decoded.slice(0, index)),
    password: decodeComponent(decoded.slice(index + 1)),
  };
};
