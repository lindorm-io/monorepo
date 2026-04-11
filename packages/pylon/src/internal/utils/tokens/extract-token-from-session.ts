import { Aegis, ParsedJwt } from "@lindorm/aegis";
import { IPylonSession } from "../../../interfaces";

export const extractTokenFromSession = (
  session: IPylonSession | null | undefined,
): ParsedJwt | null => {
  if (!session) return null;
  if (typeof session.accessToken !== "string" || session.accessToken.length === 0) {
    return null;
  }
  try {
    return Aegis.parse(session.accessToken);
  } catch {
    return null;
  }
};
