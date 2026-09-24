import {
  AegisError,
  type IAegis,
  isStructuredToken,
  type VerifiedToken,
} from "@lindorm/aegis";
import { isString } from "@lindorm/is";
import type { IPylonSession } from "../../../interfaces/index.js";

export const extractTokenFromSession = async (
  aegis: IAegis,
  session: IPylonSession | null | undefined,
  critical: Array<string> | undefined,
): Promise<VerifiedToken | null> => {
  if (!session) return null;
  if (!isString(session.accessToken) || session.accessToken.length === 0) {
    return null;
  }
  try {
    const verified = await aegis.verify(session.accessToken, undefined, { critical });
    // Claims-bearing, not "is a JWT" — see `parseSessionTokens`.
    return isStructuredToken(verified) ? verified : null;
  } catch (err) {
    if (!(err instanceof AegisError)) throw err;
    return null;
  }
};
