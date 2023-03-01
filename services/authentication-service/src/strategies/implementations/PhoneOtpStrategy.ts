import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { AuthenticationStrategyConfig, ServerKoaContext } from "../../types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ConfirmStrategyOptions, StrategyBase } from "../../class";
import { argon } from "../../instance";
import { authenticateIdentifier, createAccountCallback, resolveIdentity } from "../../handler";
import { clientCredentialsMiddleware } from "../../middleware";
import { randomNumberAsync } from "../../util";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
  IdentifierType,
  SendOtpRequestBody,
} from "@lindorm-io/common-types";

export class PhoneOtpStrategy extends StrategyBase {
  public config(): AuthenticationStrategyConfig {
    return {
      identifierHint: "phone",
      identifierType: IdentifierType.PHONE,
      loa: 2,
      loaMax: 3,
      method: AuthenticationMethod.PHONE,
      methodsMax: 9,
      methodsMin: 1,
      mfaCookie: true,
      strategy: AuthenticationStrategy.PHONE_OTP,
      weight: 10,
    };
  }

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
      template: "authentication-phone-otp",
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
      expiresIn: this.expiresIn(strategySession),
      pollingRequired: false,
      qrCode: null,
      strategySessionToken: this.sessionToken(ctx, strategySession),
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

    logger.debug("Verifying Identity");

    authenticationSession = await resolveIdentity(ctx, authenticationSession, strategySession);

    await authenticateIdentifier(ctx, authenticationSession, strategySession);

    logger.debug("Resolving Account");

    if (!authenticationSession.identityId) {
      throw new ServerError("Invalid authentication session", {
        description: "Attribute is required",
        debug: { identityId: authenticationSession.identityId },
      });
    }

    return accountRepository.findOrCreate(
      { id: authenticationSession.identityId },
      createAccountCallback(ctx),
    );
  }
}
