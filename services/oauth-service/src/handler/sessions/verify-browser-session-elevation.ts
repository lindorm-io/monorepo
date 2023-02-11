import { BROWSER_SESSION_COOKIE_NAME } from "../../constant";
import { ElevationSession } from "../../entity";
import { Environments } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { assertElevationSession } from "../../util";
import { setBrowserSessionCookie } from "../cookies";
import { stringComparison } from "@lindorm-io/node-pkce";

export const verifyBrowserSessionElevation = async (
  ctx: ServerKoaContext,
  elevationSession: ElevationSession,
): Promise<void> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

  const cookieId = ctx.cookies.get(BROWSER_SESSION_COOKIE_NAME, {
    signed: ctx.server.environment !== Environments.TEST,
  });

  if (!cookieId) {
    throw new ServerError("Invalid cookie", {
      description: "Browser Session cookie ID is missing",
    });
  }

  if (cookieId !== elevationSession.identifiers.browserSessionId) {
    throw new ServerError("Invalid browser session", {
      data: {
        expect: cookieId,
        actual: elevationSession.identifiers.browserSessionId,
      },
    });
  }

  assertElevationSession(elevationSession);

  const browserSession = await browserSessionRepository.find({
    id: elevationSession.identifiers.browserSessionId,
  });

  if (!stringComparison(elevationSession.identityId, browserSession.identityId)) {
    throw new ServerError("Invalid identity");
  }

  const { acrValues, amrValues, latestAuthentication, levelOfAssurance } =
    elevationSession.confirmedAuthentication;

  if (!acrValues || !amrValues || !latestAuthentication || !levelOfAssurance) {
    throw new ServerError("Invalid elevationSession", {
      debug: { acrValues, amrValues, latestAuthentication, levelOfAssurance },
    });
  }

  browserSession.acrValues = acrValues;
  browserSession.amrValues = amrValues;
  browserSession.latestAuthentication = latestAuthentication;
  browserSession.levelOfAssurance = levelOfAssurance;

  await browserSessionRepository.update(browserSession);

  setBrowserSessionCookie(ctx, browserSession);
};
