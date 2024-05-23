import { KryptosDer, OctPem } from "../../../types";

type Options = Omit<KryptosDer, "algorithm" | "type" | "use">;

type Result = Omit<OctPem, "algorithm" | "type" | "use">;

const splitStringIntoChunks = (input: string, size: number): Array<string> => {
  const chunks: Array<string> = [];

  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.substring(i, i + size));
  }

  return chunks;
};

export const exportOctToPem = (options: Options): Result => {
  if (!options.privateKey) {
    throw new Error("Private key is required");
  }

  const string = options.privateKey.toString("base64");
  const chunks = splitStringIntoChunks(string, 64);

  const header = "-----BEGIN OCT PRIVATE KEY-----";
  const content = chunks.join("\n");
  const footer = "-----END OCT PRIVATE KEY-----";

  return { privateKey: [header, content, footer].join("\n"), publicKey: "" };
};
