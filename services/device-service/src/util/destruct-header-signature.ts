import { ClientError } from "@lindorm-io/errors";
import { RsaAlgorithm, RsaFormat } from "@lindorm-io/rsa";

type DestructSignature = {
  algorithm: RsaAlgorithm;
  format: RsaFormat;
  hash: string;
  headers: Array<string>;
  key: string;
};

export const destructHeaderSignature = (input: string): DestructSignature => {
  const algorithmMatch = new RegExp(/algorithm="(?<value>[^"]+)"/g).exec(input);
  const formatMatch = new RegExp(/format="(?<value>[^"]+)"/g).exec(input);
  const hashMatch = new RegExp(/hash="(?<value>[^"]+)"/g).exec(input);
  const headersMatch = new RegExp(/headers="(?<value>[^"]+)"/g).exec(input);
  const keyMatch = new RegExp(/key="(?<value>[^"]+)"/g).exec(input);

  const algorithm = algorithmMatch?.groups?.value;

  if (!algorithm) {
    throw new ClientError("Invalid signature header", {
      description: "Missing algorithm",
    });
  }

  if (
    algorithm !== RsaAlgorithm.RSA_SHA512 &&
    algorithm !== RsaAlgorithm.RSA_SHA384 &&
    algorithm !== RsaAlgorithm.RSA_SHA256
  ) {
    throw new ClientError("Invalid signature header", {
      description: "Algorithm not supported",
    });
  }

  const format = formatMatch?.groups?.value;

  if (!format) {
    throw new ClientError("Invalid signature header", {
      description: "Missing format",
    });
  }

  if (format !== RsaFormat.BASE64 && format !== RsaFormat.HEX) {
    throw new ClientError("Invalid signature header", {
      description: "Format not supported",
    });
  }

  const hash = hashMatch?.groups?.value;

  if (!hash) {
    throw new ClientError("Invalid signature header", {
      description: "Missing signature",
    });
  }

  const headers = headersMatch?.groups?.value?.split(/\s|\,/).map((header) => header.toLowerCase());

  if (!headers?.length) {
    throw new ClientError("Invalid signature header", {
      description: "Missing headers",
    });
  }

  if (!headers.includes("date")) {
    throw new ClientError("Invalid signature header", {
      description: "Missing date header",
    });
  }

  if (!headers.includes("digest")) {
    throw new ClientError("Invalid signature header", {
      description: "Missing digest header",
    });
  }

  const key = keyMatch?.groups?.value;

  if (!key) {
    throw new ClientError("Invalid signature header", {
      description: "Missing key",
    });
  }

  return { algorithm, format, hash, headers, key };
};
