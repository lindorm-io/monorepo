import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_EMAIL, JOI_NONCE, JOI_PHONE_NUMBER } from "../../common";
import { JOI_FLOW_TYPE } from "../../constant";
import { handleFlowInitialisation } from "../../handler";
import {
  InitialiseFlowRequestData,
  InitialiseFlowResponseBody,
  ServerKoaController,
} from "../../types";

interface RequestData extends InitialiseFlowRequestData {
  remember: boolean;
}

export const initialiseFlowSchema = Joi.object<RequestData>({
  email: JOI_EMAIL.optional(),
  flowType: JOI_FLOW_TYPE.required(),
  nonce: JOI_NONCE.optional(),
  phoneNumber: JOI_PHONE_NUMBER.optional(),
  remember: Joi.boolean().required(),
  username: Joi.string().optional(),
});

export const initialiseFlowController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<InitialiseFlowResponseBody> => {
  const {
    cache: { loginSessionCache },
    data: { email, flowType, nonce, phoneNumber, remember, username },
  } = ctx;

  let loginSession = ctx.entity.loginSession;

  loginSession.remember = remember;

  loginSession = await loginSessionCache.update(loginSession);

  const body = await handleFlowInitialisation(ctx, loginSession, {
    email,
    flowType,
    nonce,
    phoneNumber,
    username,
  });

  return { body };
};
