import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentifierType } from "../../common";
import { JOI_EMAIL, JOI_PHONE_NUMBER } from "../../common";
import { JOI_IDENTIFIER_TYPE } from "../../constant";
import { ServerKoaController } from "../../types";
import { randomString } from "@lindorm-io/core";
import {
  findOrCreateIdentifier,
  initialiseConnectSession,
  sendConnectSessionMessage,
} from "../../handler";
import { ClientError } from "@lindorm-io/errors";

interface RequestData {
  identifier: string;
  label?: string;
  type: IdentifierType;
}

export const initialiseIdentifierConnectSessionSchema = Joi.object<RequestData>({
  identifier: Joi.when("type", {
    switch: [
      { is: IdentifierType.EMAIL, then: JOI_EMAIL.required() },
      { is: IdentifierType.PHONE, then: JOI_PHONE_NUMBER.required() },
    ],
    otherwise: Joi.forbidden(),
  }),
  label: Joi.string().allow(null).optional(),
  type: JOI_IDENTIFIER_TYPE.required(),
});

export const initialiseIdentifierConnectSessionController: ServerKoaController<
  RequestData
> = async (ctx): ControllerResponse => {
  const {
    data: { identifier, label, type },
    entity: { identity },
  } = ctx;

  const identifierEntity = await findOrCreateIdentifier(ctx, identity, {
    identifier,
    label,
    type,
  });

  if (identifierEntity.verified) {
    throw new ClientError("Invalid request", {
      description: "Identifier is already verified",
    });
  }

  const code = randomString(64);
  const connectSession = await initialiseConnectSession(ctx, identifierEntity, code);

  await sendConnectSessionMessage(ctx, identifierEntity, connectSession, code);
};
