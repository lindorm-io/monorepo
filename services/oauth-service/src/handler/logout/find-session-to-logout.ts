import { ServerKoaContext } from "../../types";
import { BrowserSession, RefreshSession } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { ClientError } from "@lindorm-io/errors";
import { LogoutSessionType } from "../../enum";

interface Result {
  session: BrowserSession | RefreshSession;
  type: LogoutSessionType;
}

export const findSessionToLogout = async (
  ctx: ServerKoaContext,
  sessionId: string,
): Promise<Result> => {
  const {
    repository: { browserSessionRepository, refreshSessionRepository },
  } = ctx;

  try {
    const session = await browserSessionRepository.find({ id: sessionId });

    return { session, type: LogoutSessionType.BROWSER };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  try {
    const session = await refreshSessionRepository.find({ id: sessionId });

    return { session, type: LogoutSessionType.REFRESH };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  throw new ClientError("Session does not exist");
};
