import { B64 } from "@lindorm/b64";
import type { Dict } from "@lindorm/types";

export const parseTokenHeader = (input: string): Dict | null => {
  try {
    const [encodedHeader] = input.split(".");
    return JSON.parse(B64.decode(encodedHeader, "base64url")) as Dict;
  } catch {
    return null;
  }
};
