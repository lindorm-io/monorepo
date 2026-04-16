import { Dict } from "@lindorm/types";

export const parseTokenHeader = (input: string): Dict | null => {
  try {
    const [encodedHeader] = input.split(".");
    return JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as Dict;
  } catch {
    return null;
  }
};
