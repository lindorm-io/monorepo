import {
  ConfirmConsentRequestBody,
  ConfirmConsentRequestParams,
  ConfirmConsentResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { confirmOauthConsent } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = ConfirmConsentRequestParams & ConfirmConsentRequestBody;

type ResponseBody = ConfirmConsentResponse;

export const confirmConsentSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    audiences: Joi.array().items(Joi.string().lowercase()),
    scopes: Joi.array().items(Joi.string().lowercase()),
  })
  .required();

export const confirmConsentSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id, audiences, scopes },
  } = ctx;

  const { redirectTo } = await confirmOauthConsent(ctx, id, { audiences, scopes });

  return { body: { redirectTo } };
};
