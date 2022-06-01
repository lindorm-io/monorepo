import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentifierType } from "../../common";
import { JOI_GUID } from "../../common";
import { verifyEmailConnectSession, verifyPhoneNumberConnectSession } from "../../handler";

interface RequestData {
  id: string;
  code: string;
}

export const identifierConnectVerifySchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    code: Joi.string().required(),
  })
  .required();

export const identifierConnectVerifyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { code },
    entity: { connectSession },
  } = ctx;

  switch (connectSession.type) {
    case IdentifierType.EMAIL:
      await verifyEmailConnectSession(ctx, connectSession, code);
      break;

    case IdentifierType.PHONE:
      await verifyPhoneNumberConnectSession(ctx, connectSession, code);
      break;

    default:
      throw new ClientError("Unexpected identifier type");
  }
};
