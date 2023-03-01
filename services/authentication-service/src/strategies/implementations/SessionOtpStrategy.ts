import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { argon } from "../../instance";
import { clientCredentialsMiddleware } from "../../middleware";
import { expiresIn } from "@lindorm-io/expiry";
import { getValidIdentitySessions } from "../../handler";
import { randomNumberAsync } from "../../util";
import {
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
  EmitSocketEventRequestBody,
} from "@lindorm-io/common-types";

export class SessionOtpStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "none",
    identifierType: "none",
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.SESSION_LINK,
    methodsMax: 9,
    methodsMin: 1,
    mfaCookie: true,
    strategy: AuthenticationStrategy.SESSION_OTP,
    weight: 80,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      axios: { communicationClient },
      cache: { strategySessionCache },
    } = ctx;

    if (!authenticationSession.identityId) {
      throw new ClientError("Invalid identifier", {
        description: "Identity ID not found",
      });
    }

    const confirmLength = 6;
    const otp = (await randomNumberAsync(confirmLength)).toString().padStart(confirmLength, "0");

    strategySession.secret = await argon.encrypt(otp);
    await strategySessionCache.update(strategySession);

    const sessions = await getValidIdentitySessions(ctx, authenticationSession.identityId);

    if (!sessions.length) {
      throw new ServerError("Bad Request", {
        description: "Unable to find sessions",
      });
    }

    const body: EmitSocketEventRequestBody = {
      channels: { sessions },
      content: { otp, visualHint: strategySession.visualHint },
      event: "authentication-service:session-otp-flow",
    };

    await communicationClient.post("/admin/socket/emit", {
      body,
      middleware: [clientCredentialsMiddleware()],
    });

    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.OTP,
      confirmLength,
      confirmMode: AuthenticationStrategyConfirmMode.NUMERIC,
      displayCode: null,
      expiresIn: expiresIn(strategySession.expires),
      pollingRequired: true,
      qrCode: null,
      strategySessionToken: null,
      visualHint: strategySession.visualHint,
    };
  }

  public async confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: ConfirmStrategyOptions = {},
  ): Promise<Account> {
    const {
      logger,
      repository: { accountRepository },
    } = ctx;

    const { otp } = options;

    if (!otp) {
      throw new ClientError("Invalid input", {
        data: { otp },
      });
    }

    logger.debug("Verifying OTP");

    if (!strategySession.secret) {
      throw new ServerError("Invalid strategySession", {
        debug: { otp: strategySession.secret },
      });
    }

    await argon.assert(otp, strategySession.secret);

    logger.debug("Resolving Account");

    if (!authenticationSession.identityId) {
      throw new ServerError("Invalid authenticationSession", {
        debug: { identityId: authenticationSession.identityId },
      });
    }

    return await accountRepository.find({ id: authenticationSession.identityId });
  }
}
