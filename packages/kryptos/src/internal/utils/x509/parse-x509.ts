import { KryptosError } from "../../../errors/index.js";

const PEM_BLOCK_REGEX =
  /-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+?)-----END CERTIFICATE-----/g;

const looksLikePem = (input: string): boolean =>
  input.includes("-----BEGIN CERTIFICATE-----");

const decodePemBlocks = (input: string): Array<Buffer> => {
  const matches = [...input.matchAll(PEM_BLOCK_REGEX)];

  if (matches.length === 0) {
    throw new KryptosError("Invalid PEM certificate input", {
      code: "invalid_certificate_input",
      title: "Invalid Certificate Input",
      details:
        "The input looked like PEM but contained no BEGIN/END CERTIFICATE blocks to decode.",
      data: { format: "pem" },
    });
  }

  return matches.map((match) => Buffer.from(match[1].replace(/\s+/g, ""), "base64"));
};

const decodeBase64Der = (input: string): Buffer => {
  const trimmed = input.replace(/\s+/g, "");

  if (trimmed.length === 0 || !/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    throw new KryptosError("Invalid base64-DER certificate input", {
      code: "invalid_certificate_input",
      title: "Invalid Certificate Input",
      details:
        "The input was expected to be base64-encoded DER but was empty or contained non-base64 characters.",
      data: { format: "base64-der" },
    });
  }

  return Buffer.from(trimmed, "base64");
};

const toDerBuffers = (input: string): Array<Buffer> =>
  looksLikePem(input) ? decodePemBlocks(input) : [decodeBase64Der(input)];

export const parseX509 = (input: string | Array<string>): Array<Buffer> => {
  const inputs = Array.isArray(input) ? input : [input];

  if (inputs.length === 0) {
    throw new KryptosError("certificateChain must contain at least one certificate", {
      code: "certificate_chain_empty",
      title: "Certificate Chain Empty",
      details:
        "An empty certificateChain array was provided; at least one certificate is required.",
    });
  }

  const ders: Array<Buffer> = [];
  for (const item of inputs) {
    if (typeof item !== "string" || item.length === 0) {
      throw new KryptosError("certificateChain entries must be non-empty strings", {
        code: "invalid_certificate_input",
        title: "Invalid Certificate Input",
        details:
          "A certificateChain entry was not a non-empty string; each entry must be PEM or base64-DER text.",
      });
    }
    ders.push(...toDerBuffers(item));
  }

  if (ders.length === 0) {
    throw new KryptosError("certificateChain produced no certificates", {
      code: "certificate_chain_empty",
      title: "Certificate Chain Empty",
      details: "Decoding the certificateChain input produced zero DER certificates.",
    });
  }

  return ders;
};
