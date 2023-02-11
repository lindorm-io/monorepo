import { BROWSER_SESSION_COOKIE_NAME } from "../../constant";
import { BrowserSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { Environments } from "@lindorm-io/common-types";

export const setBrowserSessionCookie = (
  ctx: ServerKoaContext,
  browserSession: BrowserSession,
): void => {
  ctx.cookies.set(BROWSER_SESSION_COOKIE_NAME, browserSession.id, {
    ...(browserSession.remember ? { expires: browserSession.expires } : {}),
    httpOnly: true,
    overwrite: true,
    signed: ctx.server.environment !== Environments.TEST,
  });
};
