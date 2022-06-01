import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { axiosInitialiseOidcSession } from "../../handler";

interface RequestData {
  provider: string;
  remember: boolean;
}

export const initialiseLoginOidcSchema = Joi.object<RequestData>({
  provider: Joi.string().required(),
  remember: Joi.boolean().required(),
});

export const initialiseLoginOidcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    data: { provider, remember },
    entity: { loginSession },
  } = ctx;

  if (!loginSession.allowedOidc.includes(provider)) {
    throw new ClientError("Invalid provider");
  }

  const { redirectTo } = await axiosInitialiseOidcSession(ctx, loginSession, provider);

  loginSession.remember = remember;

  await loginSessionCache.update(loginSession);

  return { redirect: redirectTo };
};
