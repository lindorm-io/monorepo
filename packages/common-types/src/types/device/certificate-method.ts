import { ReverseMap } from "../utility";

export const CertificateMethods = {
  SHA256: "sha256",
  SHA384: "sha384",
  SHA512: "sha512",
} as const;

export type CertificateMethod = ReverseMap<typeof CertificateMethods>;
