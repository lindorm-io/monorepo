import { BrowserSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { VerifiedIdentityToken } from "../../common";
import { getBrowserSessionCookies } from "../cookies";

export const tryFindBrowserSessions = async (
  ctx: ServerKoaContext,
  idToken?: VerifiedIdentityToken,
): Promise<Array<BrowserSession>> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

  const cookies = getBrowserSessionCookies(ctx);
  const result: Array<BrowserSession> = [];

  for (const id of cookies) {
    const session = await browserSessionRepository.tryFind({ id });
    if (!session) continue;
    result.push(session);
  }

  if (idToken) {
    return result.filter((x) => x.identityId === idToken.subject);
  }

  return result;
};
