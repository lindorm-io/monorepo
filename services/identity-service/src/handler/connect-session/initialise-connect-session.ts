import { ClientError } from "@lindorm-io/errors";
import { ConnectSession, Identity } from "../../entity";
import { ServerKoaContext } from "../../types";
import { IdentifierType, SendEmailRequestData, SendSmsRequestData } from "../../common";
import { argon } from "../../instance";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { getRandomNumberAsync, stringToSeconds } from "@lindorm-io/core";

interface Options {
  identifier: string;
  type: IdentifierType;
}

export const initialiseConnectSession = async (
  ctx: ServerKoaContext,
  identity: Identity,
  options: Options,
): Promise<ConnectSession> => {
  const {
    axios: { communicationClient, oauthClient },
    cache: { connectSessionCache },
  } = ctx;

  const { identifier, type } = options;

  const expiresIn = stringToSeconds(configuration.expiry.connect_identifier_session);
  const code = (await getRandomNumberAsync(6)).toString().padStart(6, "0");

  const session = await connectSessionCache.create(
    new ConnectSession({
      code: await argon.encrypt(code.toString()),
      identifier,
      identityId: identity.id,
      type,
    }),
    expiresIn,
  );

  let emailData: SendEmailRequestData;
  let smsData: SendSmsRequestData;
  let send: string;

  switch (type) {
    case IdentifierType.EMAIL:
      send = "email";
      emailData = {
        content: { expiresIn, otp: code },
        template: "connect-email",
        to: identifier,
      };
      break;

    case IdentifierType.PHONE:
      send = "sms";
      smsData = {
        content: { expiresIn, otp: code },
        template: "connect-phone",
        to: identifier,
      };
      break;

    default:
      throw new ClientError("Unexpected type");
  }

  await communicationClient.post(`/internal/send/${send}`, {
    data: send === "email" ? emailData : smsData,
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });

  return session;
};
