import { SubjectHint, TokenType } from "@lindorm-io/common-enums";
import { StrategySession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";

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
    type: TokenType.STRATEGY,
  });

  return token;
};
