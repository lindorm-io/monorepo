import { baseParse } from "@lindorm-io/core";
import { TokenHeaderType } from "../../enum";

export const getTokenHeaderType = (token: string): TokenHeaderType => {
  try {
    const [header] = token.split(".");
    const parsed = JSON.parse(baseParse(header));

    return parsed.typ;
  } catch {
    throw new Error("Invalid token header");
  }
};
