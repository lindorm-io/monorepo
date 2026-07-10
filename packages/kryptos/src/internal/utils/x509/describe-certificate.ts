import { B64 } from "@lindorm/b64";
import type { ParsedX509Name } from "../../../types/index.js";
import { parseX509Certificate } from "./parse-certificate.js";
import { signAlgorithmName } from "./sign-algorithm-name.js";

export type DescribedX509Name = {
  commonName?: string;
  organization?: string;
};

export type DescribedX509BasicConstraints = {
  ca: boolean;
  pathLenConstraint?: number;
};

// A public, secret-free description of an X.509 certificate for inspection.
export type DescribedX509Certificate = {
  subject: DescribedX509Name;
  issuer: DescribedX509Name;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  signatureAlgorithm: string;
  basicConstraints: DescribedX509BasicConstraints;
  keyUsage: Array<string>;
  subjectAltNames: Array<string>;
};

const describeName = (name: ParsedX509Name): DescribedX509Name => ({
  ...(name.commonName ? { commonName: name.commonName } : {}),
  ...(name.organization ? { organization: name.organization } : {}),
});

// Parse one DER certificate (base64) into its public description.
export const describeCertificate = (der: string): DescribedX509Certificate => {
  const cert = parseX509Certificate(B64.toBuffer(der, "base64"));

  return {
    subject: describeName(cert.subject),
    issuer: describeName(cert.issuer),
    serialNumber: cert.serialNumber.toString("hex"),
    notBefore: cert.notBefore.toISOString(),
    notAfter: cert.notAfter.toISOString(),
    signatureAlgorithm: signAlgorithmName(cert.signatureAlgorithm),
    basicConstraints: {
      ca: cert.extensions.basicConstraintsCa,
      ...(cert.extensions.basicConstraintsPathLen !== undefined
        ? { pathLenConstraint: cert.extensions.basicConstraintsPathLen }
        : {}),
    },
    keyUsage: [...cert.extensions.keyUsage],
    subjectAltNames: cert.extensions.subjectAltNames.map(
      (san) => `${san.type}:${san.value}`,
    ),
  };
};
