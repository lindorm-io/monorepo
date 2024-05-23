import { defaultFilterCallback } from "./private/default-filter-callback";
import { sanitiseToken } from "./sanitise-token";

export const sanitiseAuthorization = (authorization: string): string => {
  if (!authorization) return authorization;

  if (authorization.includes("Basic")) {
    return `Basic ${defaultFilterCallback(authorization)}`;
  }

  if (!authorization.includes("Bearer")) {
    return defaultFilterCallback(authorization);
  }

  const split = authorization.split(" ");

  return `Bearer ${sanitiseToken(split[1])}`;
};
