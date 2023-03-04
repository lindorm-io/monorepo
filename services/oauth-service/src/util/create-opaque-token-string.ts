import { randomString } from "@lindorm-io/random";
import { baseHash } from "@lindorm-io/core";

export const createOpaqueTokenString = () => {
  const header = baseHash(JSON.stringify({ typ: "OPAQUE" })).replace(/=/g, "");
  const payload = randomString(128, { numbers: "random" });
  const signature = randomString(32, {
    numbers: "random",
    symbols: "1/6",
    custom: { symbols: "-_~!@#$%^*" },
  });

  return `${header}.${payload}.${signature}`;
};
