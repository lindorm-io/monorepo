import { ClientError } from "@lindorm-io/errors";

type DestructDigest = {
  algorithm: "SHA256" | "SHA384" | "SHA512";
  format: "base64" | "hex";
  hash: string;
};

export const destructHeaderDigest = (input: string): DestructDigest => {
  const algorithmMatch = new RegExp(/algorithm="(?<value>[^"]+)"/g).exec(input);
  const formatMatch = new RegExp(/format="(?<value>[^"]+)"/g).exec(input);
  const hashMatch = new RegExp(/hash="(?<value>[^"]+)"/g).exec(input);

  const algorithm = algorithmMatch?.groups?.value;

  if (!algorithm) {
    throw new ClientError("Invalid digest header", {
      description: "Missing algorithm",
    });
  }

  if (algorithm !== "SHA256" && algorithm !== "SHA384" && algorithm !== "SHA512") {
    throw new ClientError("Invalid digest header", {
      description: "Algorithm not supported",
    });
  }

  const format = formatMatch?.groups?.value;

  if (!format) {
    throw new ClientError("Invalid digest header", {
      description: "Missing format",
    });
  }

  if (format !== "base64" && format !== "hex") {
    throw new ClientError("Invalid digest header", {
      description: "Format not supported",
    });
  }

  const hash = hashMatch?.groups?.value;

  if (!hash) {
    throw new ClientError("Invalid digest header", {
      description: "Missing digest",
    });
  }

  return { algorithm, format, hash };
};
