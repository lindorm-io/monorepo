import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ConnectSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentifierType } from "../../common";
import { JOI_EMAIL, JOI_PHONE_NUMBER } from "../../common";
import { JOI_IDENTIFIER_TYPE } from "../../constant";
import { ServerKoaController } from "../../types";
import { initialiseEmailConnectSession, initialisePhoneNumberConnectSession } from "../../handler";

interface RequestData {
  identifier: string;
  type: IdentifierType;
}

interface ResponseBody {
  sessionId: string;
}

export const identifierConnectInitialiseSchema = Joi.object<RequestData>({
  identifier: Joi.when("type", {
    switch: [
      { is: IdentifierType.EMAIL, then: JOI_EMAIL.required() },
      { is: IdentifierType.PHONE, then: JOI_PHONE_NUMBER.required() },
    ],
    otherwise: Joi.forbidden(),
  }),
  type: JOI_IDENTIFIER_TYPE.required(),
});

export const identifierConnectInitialiseController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { identifier, type },
    entity: { identity },
  } = ctx;

  let session: ConnectSession;

  switch (type) {
    case IdentifierType.EMAIL:
      session = await initialiseEmailConnectSession(ctx, identity, identifier);
      break;

    case IdentifierType.PHONE:
      session = await initialisePhoneNumberConnectSession(ctx, identity, identifier);
      break;

    default:
      throw new ClientError("Unexpected identifier type");
  }

  return { body: { sessionId: session.id } };
};
