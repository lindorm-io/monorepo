import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    axios: { axiosClient },
    mongo: { browserSessionRepository, clientRepository, clientSessionRepository },
    token: {
      bearerToken: { token: accessToken, subject: identityId },
    },
  } = ctx;

  const clients = await clientRepository.findMany();

  for (const client of clients) {
    if (!client.rtbfUri) continue;

    await axiosClient.get(client.rtbfUri, {
      middleware: [axiosBearerAuthMiddleware(accessToken)],
    });
  }

  await browserSessionRepository.deleteMany({ identityId });
  await clientSessionRepository.deleteMany({ identityId });
};
