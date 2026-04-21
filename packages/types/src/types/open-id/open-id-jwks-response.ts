import type { Jwks } from "../jwks/index.js";

export type OpenIdJwksResponse = {
  keys: Array<Jwks>;
};
