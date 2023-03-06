import { randomToken } from "@lindorm-io/random";
import { baseHash } from "@lindorm-io/core";

export const createOpaqueToken = (): string => {
  const header = baseHash(JSON.stringify({ typ: "OPAQUE" })).replace(/=/g, "");
  const payload = randomToken(192);
  return `${header}.${payload}`;
};
