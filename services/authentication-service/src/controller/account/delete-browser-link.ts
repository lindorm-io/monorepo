import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
}

export const deleteBrowserLinkSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const deleteBrowserLinkController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { browserLink },
    repository: { browserLinkRepository },
    token: {
      bearerToken: { subject: accountId },
    },
  } = ctx;

  if (accountId !== browserLink.accountId) {
    throw new ClientError("Unauthorized", {
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  await browserLinkRepository.destroy(browserLink);
};
