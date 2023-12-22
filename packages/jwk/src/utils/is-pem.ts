import { EcPemValues, OctPemValues, PemValues, RsaPemValues } from "../types";

export const isEcPem = (input: Record<string, any>): input is EcPemValues =>
  typeof input === "object" && input.type === "EC" && typeof input.curve === "string";

export const isRsaPem = (input: Record<string, any>): input is RsaPemValues =>
  typeof input === "object" && input.type === "RSA";

export const isOctPem = (input: Record<string, any>): input is OctPemValues =>
  typeof input === "object" && input.type === "oct" && typeof input.symmetricKey === "string";

export const isPem = (input: Record<string, any>): input is PemValues =>
  isEcPem(input) || isRsaPem(input) || isOctPem(input);
