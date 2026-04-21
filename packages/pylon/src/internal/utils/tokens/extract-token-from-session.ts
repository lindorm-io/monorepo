import { AegisError, type IAegis, isParsedJwt, type ParsedJwt } from "@lindorm/aegis";
import type { IPylonSession } from "../../../interfaces/index.js";

export const extractTokenFromSession = async (
  aegis: IAegis,
  session: IPylonSession | null | undefined,
): Promise<ParsedJwt | null> => {
  if (!session) return null;
  if (typeof session.accessToken !== "string" || session.accessToken.length === 0) {
    return null;
  }
  try {
    const verified = await aegis.verify(session.accessToken);
    return isParsedJwt(verified) ? verified : null;
  } catch (err) {
    if (!(err instanceof AegisError)) throw err;
    return null;
  }
};
