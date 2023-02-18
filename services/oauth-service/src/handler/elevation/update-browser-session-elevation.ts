import { ElevationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { uniqArray } from "@lindorm-io/core";
import { getBrowserSessionCookies } from "../cookies";

export const updateBrowserSessionElevation = async (
  ctx: ServerKoaContext,
  elevationSession: ElevationSession,
): Promise<void> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

  if (!elevationSession.browserSessionId) {
    throw new ServerError("Invalid elevation session", {
      debug: { browserSessionId: elevationSession.browserSessionId },
    });
  }

  const browserSession = await browserSessionRepository.find({
    id: elevationSession.browserSessionId,
  });

  const cookies = getBrowserSessionCookies(ctx);

  if (!cookies.includes(browserSession.id)) {
    throw new ServerError("Invalid browser session", {
      debug: {
        expect: cookies,
        actual: elevationSession.browserSessionId,
      },
    });
  }

  if (elevationSession.identityId !== browserSession.identityId) {
    throw new ServerError("Invalid identity");
  }

  if (
    !elevationSession.confirmedAuthentication.latestAuthentication ||
    !elevationSession.confirmedAuthentication.levelOfAssurance ||
    !elevationSession.confirmedAuthentication.methods
  ) {
    throw new ServerError("Invalid elevationSession", {
      debug: { confirmedAuthentication: elevationSession.confirmedAuthentication },
    });
  }

  browserSession.latestAuthentication =
    elevationSession.confirmedAuthentication.latestAuthentication;
  browserSession.levelOfAssurance = elevationSession.confirmedAuthentication.levelOfAssurance;
  browserSession.methods = uniqArray(
    browserSession.methods,
    elevationSession.confirmedAuthentication.methods,
  );

  await browserSessionRepository.update(browserSession);
};
