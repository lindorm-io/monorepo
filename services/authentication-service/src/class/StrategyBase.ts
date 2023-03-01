import { Account, AuthenticationSession, StrategySession } from "../entity";
import { AuthenticationStrategyConfig, ServerKoaContext, StrategyHandler } from "../types";
import { AuthenticationTokenType, AuthStrategyConfig, SubjectHint } from "@lindorm-io/common-types";
import { configuration } from "../server/configuration";
import { expiryObject } from "@lindorm-io/expiry";

export type ConfirmStrategyOptions = {
  challengeConfirmationToken?: string;
  code?: string;
  otp?: string;
  password?: string;
  token?: string;
  totp?: string;
};

export abstract class StrategyBase implements StrategyHandler {
  public abstract config(): AuthenticationStrategyConfig;

  public abstract initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig>;

  public abstract confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options?: ConfirmStrategyOptions,
  ): Promise<Account>;

  protected expiresIn(strategySession: StrategySession): number {
    const { expiresIn } = expiryObject(strategySession.expires);
    return expiresIn;
  }

  protected sessionToken(ctx: ServerKoaContext, strategySession: StrategySession): string {
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
  }
}
