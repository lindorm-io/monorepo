import { BrowserSession, RefreshSession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { LogoutSessionType, SessionHint } from "../../enum";
import { ServerKoaContext } from "../../types";

type Result = {
  session: BrowserSession | RefreshSession;
  type: LogoutSessionType;
};

export const findSessionToLogout = async (
  ctx: ServerKoaContext,
  sessionId: string,
  sessionHint?: string | null,
): Promise<Result> => {
  const {
    repository: { browserSessionRepository, refreshSessionRepository },
  } = ctx;

  if (!sessionHint || sessionHint === SessionHint.BROWSER) {
    try {
      const session = await browserSessionRepository.find({ id: sessionId });

      return { session, type: LogoutSessionType.BROWSER };
    } catch (err: any) {
      if (!(err instanceof EntityNotFoundError)) {
        throw err;
      }
    }
  }

  if (!sessionHint || sessionHint === SessionHint.REFRESH) {
    try {
      const session = await refreshSessionRepository.find({ id: sessionId });

      return { session, type: LogoutSessionType.REFRESH };
    } catch (err: any) {
      if (!(err instanceof EntityNotFoundError)) {
        throw err;
      }
    }
  }

  throw new ClientError("Session does not exist");
};
