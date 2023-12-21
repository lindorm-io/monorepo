import { EcPemValues, PemValues, RsaPemValues } from "../types";

const isEcPem = (input: Record<string, any>): input is EcPemValues =>
  typeof input === "object" && input.type === "EC" && typeof input.curve === "string";

const isRsaPem = (input: Record<string, any>): input is RsaPemValues =>
  typeof input === "object" && input.type === "RSA";

export const isPem = (input: Record<string, any>): input is PemValues =>
  isEcPem(input) || isRsaPem(input);
