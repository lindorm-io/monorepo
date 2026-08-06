import { isString } from "@lindorm/is";
import type {
  PylonAuthDriverContext,
  PylonAuthEndpoints,
} from "../../../../types/index.js";
import { fetchUserinfo } from "./fetch-userinfo.js";

export type ResolveSubjectOptions = {
  accessToken: string;
  endpoints: PylonAuthEndpoints;
};

/**
 * Establish the subject behind an OPAQUE access token by asking the userinfo
 * endpoint who it belongs to.
 *
 * Best effort by contract: it returns `null` rather than throwing, because the
 * caller has other provenances to try (a verified id_token, a verified JWT
 * access token) and only fails once every one of them has come back empty.
 */
export const resolveSubject = async (
  context: PylonAuthDriverContext,
  options: ResolveSubjectOptions,
): Promise<string | null> => {
  if (!isString(options.endpoints.userinfoEndpoint)) return null;

  try {
    const { subject } = await fetchUserinfo(context, options);
    return subject || null;
  } catch (error) {
    context.logger.debug("Could not resolve subject from userinfo endpoint", { error });
    return null;
  }
};
