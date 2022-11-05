import { AuthenticationStrategyConfig } from "../../../constant";
import { ClientScope, SendCodeRequestData } from "../../../common";
import { ServerKoaContext } from "../../../types";
import { StrategySession } from "../../../entity";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { randomNumberAsync } from "../../../util";

interface Options {
  email: string;
}

export const initialiseEmailOtp = async (
  ctx: ServerKoaContext,
  strategySession: StrategySession,
  config: AuthenticationStrategyConfig,
  options: Options,
): Promise<void> => {
  const {
    cache: { strategySessionCache },
    axios: { communicationClient, oauthClient },
  } = ctx;

  const { email } = options;

  const otp = (await randomNumberAsync(config.confirmLength))
    .toString()
    .padStart(config.confirmLength, "0");

  strategySession.otp = await argon.encrypt(otp);

  await strategySessionCache.update(strategySession);

  const body: SendCodeRequestData = {
    content: {
      expires: strategySession.expires,
      otp,
    },
    template: "authentication-email-otp",
    to: email,
    type: "email",
  };

  await communicationClient.post("/internal/send/otp", {
    body,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
