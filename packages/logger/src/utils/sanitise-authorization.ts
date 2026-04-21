import { defaultFilterCallback } from "../internal/utils/default-filter-callback.js";
import { sanitiseToken } from "./sanitise-token.js";

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
