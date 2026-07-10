export type ParsedX509KeyUsageFlag =
  | "digitalSignature"
  | "nonRepudiation"
  | "keyEncipherment"
  | "dataEncipherment"
  | "keyAgreement"
  | "keyCertSign"
  | "crlSign"
  | "encipherOnly"
  | "decipherOnly";

export type ParsedX509SubjectAltName = {
  readonly type: "uri" | "dns" | "email" | "ip";
  readonly value: string;
};

export type X509SubjectAltNameInput =
  | { type: "uri"; value: string }
  | { type: "dns"; value: string }
  | { type: "email"; value: string }
  | { type: "ip"; value: string };

export type ParsedX509Name = {
  readonly commonName?: string;
  readonly organization?: string;
  readonly organizationalUnit?: string;
  readonly raw: Buffer;
};

export type ParsedX509Extensions = {
  readonly basicConstraintsCa: boolean;
  readonly basicConstraintsPathLen?: number;
  // Criticality flags (RFC 5280 §4.2): basicConstraints MUST be critical in CA
  // certs (§4.2.1.9); keyUsage SHOULD be critical (§4.2.1.3). Present only when
  // the corresponding extension is present.
  readonly basicConstraintsCritical?: boolean;
  readonly keyUsageCritical?: boolean;
  readonly keyUsage: ReadonlyArray<ParsedX509KeyUsageFlag>;
  readonly subjectKeyIdentifier?: Buffer;
  readonly authorityKeyIdentifier?: Buffer;
  readonly subjectAltNames: ReadonlyArray<ParsedX509SubjectAltName>;
};

export type ParsedX509Certificate = {
  readonly tbsBytes: Buffer;
  readonly signatureAlgorithm: string;
  readonly signatureBytes: Buffer;
  readonly serialNumber: Buffer;
  readonly issuer: ParsedX509Name;
  readonly subject: ParsedX509Name;
  readonly notBefore: Date;
  readonly notAfter: Date;
  readonly subjectPublicKeyInfo: Buffer;
  readonly extensions: ParsedX509Extensions;
};
