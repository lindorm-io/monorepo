import { LindormIdentityClaims } from "@lindorm-io/common-types";
import { JwtVerify } from "@lindorm-io/jwt";
import { BrowserSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getBrowserSessionCookies } from "../cookies";

export const tryFindBrowserSessions = async (
  ctx: ServerKoaContext,
  idToken?: JwtVerify<LindormIdentityClaims>,
): Promise<Array<BrowserSession>> => {
  const {
    mongo: { browserSessionRepository },
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
