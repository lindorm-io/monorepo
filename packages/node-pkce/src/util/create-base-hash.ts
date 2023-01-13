import { createHash } from "crypto";

export const createBaseHash = (input: string): string =>
  createHash("sha256").update(input, "utf8").digest("base64url");
