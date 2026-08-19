// The encoding axis of `Kryptos.certificate(format)`, mirroring `KryptosFormat`
// for key material. Parsing is not an encoding — see `Kryptos.parseCertificate`.
export type KryptosCertificateFormat = "b64" | "der" | "jwk" | "pem";

// ⚠ MIXED encoding, and required to be: RFC 7515 §4.1.6 defines an `x5c` entry
// as standard base64 of the DER, while RFC 7517 §4.8/§4.9 define `x5t`/`x5t#S256`
// as base64url. Re-spelling either side to match the other breaks the JOSE wire.
export type KryptosCertificateB64 = {
  chain: Array<string>;
  thumbprint: string;
  thumbprintSha1: string;
};

// Raw bytes: `chain` entries are the DER a COSE `COSE_X509` bstr carries
// (RFC 9360 §2), and the digests are the raw hash output.
export type KryptosCertificateDer = {
  chain: Array<Buffer>;
  thumbprint: Buffer;
  thumbprintSha1: Buffer;
};

// The same record spelled with JOSE member names — RFC 7517 §4.7 (`x5c`),
// §4.8 (`x5t`, SHA-1) and §4.9 (`x5t#S256`).
export type KryptosCertificateJwk = {
  x5c: Array<string>;
  x5t: string;
  "x5t#S256": string;
};

// PEM CERTIFICATE blocks, leaf first. A digest has no PEM spelling, so this
// record carries the chain alone; `export("pem")` takes its `certificate` from
// `chain[0]` and its `certificateChain` from `chain`.
export type KryptosCertificatePem = {
  chain: Array<string>;
};

export type KryptosCertificate =
  | KryptosCertificateB64
  | KryptosCertificateDer
  | KryptosCertificateJwk
  | KryptosCertificatePem;
