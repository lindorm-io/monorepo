import { randomBytes } from "crypto";

type Options = {
  entropy?: number;
  namespace?: string;
  timestamp?: boolean;
};

export const randomId = (options: Options = {}): string => {
  options.entropy = options.entropy ?? 128;
  options.timestamp = options.timestamp ?? false;

  if (options.timestamp) {
    options.entropy -= 64;
  }
  if (options.entropy < 16) {
    throw new Error("final entropy must be at least 16");
  }
  if (options.entropy % 8 !== 0) {
    throw new Error("entropy must be a multiple of 8");
  }
  if ((options.entropy / 8) % 2 !== 0) {
    throw new Error("entropy must be a multiple of 2");
  }
  if (options.namespace && options.namespace.length > 32) {
    throw new Error("namespace cannot be greater than 32 characters");
  }

  options.entropy = options.entropy / 8 / 2;

  return Buffer.concat([
    randomBytes(options.entropy),
    options.namespace ? Buffer.from(options.namespace) : Buffer.alloc(0),
    options.timestamp ? Buffer.from(Date.now().toString(36)) : Buffer.alloc(0),
    randomBytes(options.entropy),
  ]).toString("base64url");
};
