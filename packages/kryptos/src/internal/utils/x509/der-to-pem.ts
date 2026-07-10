// Wrap a single-line base64 string into 64-char PEM body lines.
const wrap64 = (base64: string): string => base64.match(/.{1,64}/g)?.join("\n") ?? base64;

// Encode a base64 (standard) DER certificate — as stored in
// `Kryptos.certificateChain` — into a standard PEM CERTIFICATE block.
export const certDerToPem = (base64Der: string): string =>
  `-----BEGIN CERTIFICATE-----\n${wrap64(base64Der)}\n-----END CERTIFICATE-----`;
