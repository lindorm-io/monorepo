import { ServerKoaContext } from "../../types";
import { StrategySession } from "../../entity";
import { configuration } from "../../server/configuration";
import { AuthenticationTokenType, SubjectHint } from "@lindorm-io/common-types";

export const createStrategySessionToken = (
  ctx: ServerKoaContext,
  strategySession: StrategySession,
): string => {
  const { jwt } = ctx;

  const { token } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: strategySession.expires,
    session: strategySession.id,
    sessionHint: "strategy",
    subject: strategySession.id,
    subjectHint: SubjectHint.SESSION,
    type: AuthenticationTokenType.STRATEGY_SESSION,
  });

  return token;
};
