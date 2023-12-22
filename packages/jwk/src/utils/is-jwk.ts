import { EcJwkValues, JwkValues, OctJwkValues, RsaJwkValues } from "../types";

export const isEcJwk = (input: Record<string, any>): input is EcJwkValues =>
  typeof input === "object" &&
  input.kty === "EC" &&
  typeof input.crv === "string" &&
  typeof input.x === "string" &&
  typeof input.y === "string";

export const isRsaJwk = (input: Record<string, any>): input is RsaJwkValues =>
  typeof input === "object" &&
  input.kty === "RSA" &&
  typeof input.e === "string" &&
  typeof input.n === "string";

export const isOctJwk = (input: Record<string, any>): input is OctJwkValues =>
  typeof input === "object" && input.kty === "oct" && typeof input.k === "string";

export const isJwk = (input: Record<string, any>): input is JwkValues =>
  isEcJwk(input) || isRsaJwk(input) || isOctJwk(input);
