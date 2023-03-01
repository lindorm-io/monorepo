import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { argon } from "../../instance";
import { clientCredentialsMiddleware } from "../../middleware";
import { randomNumberAsync } from "../../util";
import { expiresIn } from "@lindorm-io/expiry";
import {
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";
import {
  authenticateIdentifier,
  createAccountCallback,
  createStrategySessionToken,
  resolveIdentity,
} from "../../handler";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
  IdentifierType,
  SendOtpRequestBody,
} from "@lindorm-io/common-types";

export class EmailOtpStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "email",
    identifierType: IdentifierType.EMAIL,
    loa: 2,
    loaMax: 2,
    method: AuthenticationMethod.EMAIL,
    methodsMax: 9,
    methodsMin: 0,
    mfaCookie: true,
    strategy: AuthenticationStrategy.EMAIL_OTP,
    weight: 30,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      cache: { strategySessionCache },
      axios: { communicationClient },
    } = ctx;

    const { identifier, identifierType } = strategySession;

    if (!identifier || identifierType !== IdentifierType.EMAIL) {
      throw new ClientError("Invalid input", {
        data: { identifier, identifierType },
      });
    }

    const confirmLength = 6;
    const otp = (await randomNumberAsync(confirmLength)).toString().padStart(confirmLength, "0");

    strategySession.secret = await argon.encrypt(otp);

    await strategySessionCache.update(strategySession);

    const body: SendOtpRequestBody = {
      content: {
        expires: strategySession.expires,
        otp,
        visualHint: strategySession.visualHint,
      },
      template: "authentication-email-otp",
      to: identifier,
      type: identifierType,
    };

    await communicationClient.post("/admin/send/otp", {
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
      pollingRequired: false,
      qrCode: null,
      strategySessionToken: createStrategySessionToken(ctx, strategySession),
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
        debug: { secret: strategySession.secret },
      });
    }

    await argon.assert(otp, strategySession.secret);

    logger.debug("Verifying Identity");

    authenticationSession = await resolveIdentity(ctx, authenticationSession, strategySession);

    const { identityId } = await authenticateIdentifier(
      ctx,
      authenticationSession,
      strategySession,
    );

    logger.debug("Resolving Account");

    return accountRepository.findOrCreate({ id: identityId }, createAccountCallback(ctx));
  }
}
