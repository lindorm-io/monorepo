import {
  ConfirmBackchannelConsentRequestBody,
  ConfirmBackchannelConsentRequestParams,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { difference } from "lodash";
import { resolveBackchannelAuthentication } from "../../handler";
import { ServerKoaController } from "../../types";
import { assertSessionPending } from "../../util";

type RequestData = ConfirmBackchannelConsentRequestParams & ConfirmBackchannelConsentRequestBody;

export const confirmBackchannelConsentSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    audiences: Joi.array().items(Joi.string().guid()).required(),
    scopes: Joi.array().items(Joi.string()).required(),
  })
  .required();

export const confirmBackchannelConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { backchannelSessionCache },
    data: { audiences, scopes },
    entity: { client },
    logger,
  } = ctx;

  let backchannelSession = ctx.entity.backchannelSession;

  assertSessionPending(backchannelSession.status.consent);

  const wrongAudiences = difference(backchannelSession.requestedConsent.audiences, audiences);

  if (wrongAudiences.length) {
    throw new ClientError("Invalid Audiences", {
      description: "Unexpected audiences added",
      data: {
        expect: backchannelSession.requestedConsent.audiences,
        actual: audiences,
        wrong: wrongAudiences,
      },
    });
  }

  const missingScopes = difference(client.requiredScopes, scopes);

  if (missingScopes.length) {
    throw new ClientError("Invalid Scopes", {
      description: "Required scopes missing",
      data: {
        expect: client.requiredScopes,
        actual: scopes,
        missing: missingScopes,
      },
    });
  }

  const wrongScopes = difference(backchannelSession.requestedConsent.scopes, scopes);

  if (wrongScopes.length) {
    throw new ClientError("Invalid Scopes", {
      description: "Unexpected scopes added",
      data: {
        expect: backchannelSession.requestedConsent.scopes,
        actual: scopes,
        wrong: wrongScopes,
      },
    });
  }

  logger.debug("Updating backchannel session");

  backchannelSession.confirmConsent({
    audiences,
    scopes,
  });

  backchannelSession = await backchannelSessionCache.update(backchannelSession);

  await resolveBackchannelAuthentication(ctx, client, backchannelSession);
};
