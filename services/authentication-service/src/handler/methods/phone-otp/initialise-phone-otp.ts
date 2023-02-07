import { AuthenticationSession, StrategySession } from "../../../entity";
import { AuthenticationStrategyConfig } from "../../../constant";
import { ServerKoaContext } from "../../../types";
import { argon } from "../../../instance";
import { clientCredentialsMiddleware } from "../../../middleware";
import { randomNumberAsync } from "../../../util";
import { SendOtpRequestBody } from "@lindorm-io/common-types";
import { ClientScopes } from "../../../common";

interface Options {
  phoneNumber: string;
}

export const initialisePhoneOtp = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
  config: AuthenticationStrategyConfig,
  options: Options,
): Promise<void> => {
  const {
    cache: { strategySessionCache },
    axios: { communicationClient, oauthClient },
  } = ctx;

  const { phoneNumber } = options;

  const otp = (await randomNumberAsync(config.confirmLength))
    .toString()
    .padStart(config.confirmLength, "0");

  strategySession.otp = await argon.encrypt(otp);

  await strategySessionCache.update(strategySession);

  const body: SendOtpRequestBody = {
    content: {
      expires: strategySession.expires,
      otp,
    },
    template: "authentication-phone-otp",
    to: phoneNumber,
    type: "phone",
  };

  await communicationClient.post("/internal/send/otp", {
    body,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScopes.COMMUNICATION_MESSAGE_SEND]),
    ],
  });
};
