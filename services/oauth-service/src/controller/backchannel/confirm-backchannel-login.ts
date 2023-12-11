import {
  ConfirmBackchannelLoginRequestBody,
  ConfirmBackchannelLoginRequestParams,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE } from "../../common";
import { resolveBackchannelAuthentication } from "../../handler";
import { ServerKoaController } from "../../types";
import { assertSessionPending } from "../../util";

type RequestData = ConfirmBackchannelLoginRequestParams & ConfirmBackchannelLoginRequestBody;

export const confirmBackchannelLoginSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    factors: Joi.array().items(Joi.string().lowercase()).required(),
    identityId: Joi.string().guid().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    remember: Joi.boolean().required(),
    singleSignOn: Joi.boolean().required(),
    strategies: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export const confirmBackchannelLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { backchannelSessionCache },
    data: {
      factors,
      identityId,
      levelOfAssurance,
      metadata,
      methods,
      remember,
      singleSignOn,
      strategies,
    },
    entity: { client },
    logger,
  } = ctx;

  let backchannelSession = ctx.entity.backchannelSession;

  assertSessionPending(backchannelSession.status.login);

  logger.debug("Updating backchannel session");

  backchannelSession.confirmLogin({
    factors,
    identityId,
    latestAuthentication: new Date(),
    levelOfAssurance,
    metadata,
    methods,
    remember,
    singleSignOn,
    strategies,
  });

  backchannelSession = await backchannelSessionCache.update(backchannelSession);

  await resolveBackchannelAuthentication(ctx, client, backchannelSession);
};
