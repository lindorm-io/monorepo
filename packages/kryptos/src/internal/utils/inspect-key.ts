import { B64 } from "@lindorm/b64";
import type { IKryptos } from "../../interfaces/index.js";
import {
  describeCertificate,
  type DescribedX509Certificate,
  type DescribedX509Name,
} from "./x509/describe-certificate.js";

// JWK members that carry secret bytes — NEVER rendered, not even truncated.
const SECRET_MEMBERS = ["d", "k", "priv", "p", "q", "dp", "dq", "qi"] as const;

const isSecretMember = (member: string): boolean =>
  (SECRET_MEMBERS as readonly string[]).includes(member);

const row = (label: string, value: unknown): string =>
  `  ${label.padEnd(12)} ${value === null || value === undefined || value === "" ? "—" : String(value)}`;

const nameText = (name: DescribedX509Name): string =>
  [
    name.commonName && `CN=${name.commonName}`,
    name.organization && `O=${name.organization}`,
    name.organizationalUnit && `OU=${name.organizationalUnit}`,
  ]
    .filter(Boolean)
    .join(", ") || "—";

const critical = (flag: boolean | undefined): string => (flag ? " (critical)" : "");

const basicConstraintsText = (cert: DescribedX509Certificate): string =>
  (cert.basicConstraints.ca
    ? `CA=true${
        cert.basicConstraints.pathLenConstraint !== undefined
          ? `, pathLen=${cert.basicConstraints.pathLenConstraint}`
          : ""
      }`
    : "CA=false") + critical(cert.basicConstraints.critical);

// One compact block per certificate (leaf first).
const certificateBlock = (cert: DescribedX509Certificate, index: number): string =>
  [
    `  [${index}] subject     ${nameText(cert.subject)}`,
    `      issuer      ${nameText(cert.issuer)}`,
    `      serial      ${cert.serialNumber}`,
    `      validity    ${cert.notBefore} → ${cert.notAfter}`,
    `      sigAlg      ${cert.signatureAlgorithm}`,
    `      basic       ${basicConstraintsText(cert)}`,
    `      keyUsage    ${cert.keyUsage.length ? cert.keyUsage.join(", ") : "—"}${critical(cert.keyUsageCritical)}`,
    `      sans        ${cert.subjectAltNames.length ? cert.subjectAltNames.join(", ") : "—"}`,
  ].join("\n");

// Human-readable, secret-free summary of a key.
export const inspectSummary = (key: IKryptos): string => {
  const lines = [
    `Kryptos ${key.type}/${key.algorithm}/${key.use}`,
    row("kid", key.id),
    row("curve", key.curve),
    row("encryption", key.encryption),
    row("purpose", key.purpose),
    row("publish", key.publish),
    row("ownerId", key.ownerId),
    row("issuer", key.issuer),
    row("jwksUri", key.jwksUri),
    row("createdAt", key.createdAt.toISOString()),
    row("notBefore", key.notBefore.toISOString()),
    row("expiresAt", key.expiresAt.toISOString()),
    row("operations", key.operations.join(", ")),
    row("privateKey", key.hasPrivateKey),
    row("publicKey", key.hasPublicKey),
    row("thumbprint", key.thumbprint),
  ];

  if (key.hasCertificate) {
    lines.push(row("x5t#S256", key.certificateThumbprint));
    lines.push(`  certificates (${key.certificateChain.length}):`);
    key.certificateChain.forEach((der, index) => {
      lines.push(certificateBlock(describeCertificate(der), index));
    });
  }

  return lines.join("\n");
};

// The decoded private JWK with secret members replaced by `<n bytes>` markers,
// plus the fully-parsed (public) certificate chain when present.
export const inspectJson = (key: IKryptos): string => {
  const jwk = key.toJWK("private") as Record<string, unknown>;

  const redacted: Record<string, unknown> = {};
  for (const [member, value] of Object.entries(jwk)) {
    redacted[member] =
      isSecretMember(member) && typeof value === "string"
        ? `<${B64.toBuffer(value, "b64u").length} bytes>`
        : value;
  }

  if (key.hasCertificate) {
    redacted.certificates = key.certificateChain.map((der) => describeCertificate(der));
  }

  return JSON.stringify(redacted, null, 2);
};
