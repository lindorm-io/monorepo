import { FlowSession, LoginSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { filter, includes, orderBy } from "lodash";
import { SessionStatus } from "../../common";

export const getCurrentFlowSession = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
): Promise<FlowSession | null> => {
  const {
    cache: { flowSessionCache },
  } = ctx;

  const flowSessions = await flowSessionCache.findMany(
    { loginSessionId: loginSession.id },
    { scan: false },
  );

  const validSessions = filter(
    flowSessions,
    (item) => !includes([SessionStatus.CONFIRMED, SessionStatus.REJECTED], item.status),
  );

  if (!validSessions.length) {
    return null;
  }

  const ordered = orderBy(validSessions, ["created"], ["desc"]);

  return ordered[0];
};
