import { Jwks } from "../jwks";

export type OpenIdJwksResponse = {
  keys: Array<Jwks>;
};
