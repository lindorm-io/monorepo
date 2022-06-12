import Joi from "joi";
import { Account, LoginSession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { FlowType } from "../../enum";
import { JOI_EMAIL, JOI_GUID, JOI_NONCE, JOI_PHONE_NUMBER } from "../../common";
import { JOI_FLOW_TYPE, JOI_PKCE_METHOD } from "../../constant";
import { configuration } from "../../server/configuration";
import { getExpires, PKCEMethod } from "@lindorm-io/core";
import { handleFlowInitialisation, resolveAllowedFlows } from "../../handler";
import { includes } from "lodash";
import {
  InitialiseFlowRequestData,
  InitialiseFlowResponseBody,
  ServerKoaController,
} from "../../types";

interface RequestData extends Partial<InitialiseFlowRequestData> {
  flowType?: FlowType;
  country?: string;
  identityId?: string;
  pkceChallenge?: string;
  pkceMethod?: PKCEMethod;
}

interface ResponseBody {
  id: string;
  flow?: InitialiseFlowResponseBody;
}

export const createLoginSessionSchema = Joi.object<RequestData>({
  country: Joi.string().length(2).lowercase().optional(),
  email: JOI_EMAIL.optional(),
  flowType: JOI_FLOW_TYPE.optional(),
  identityId: JOI_GUID.optional(),
  nonce: JOI_NONCE.optional(),
  phoneNumber: JOI_PHONE_NUMBER.optional(),
  pkceChallenge: Joi.string().optional(),
  pkceMethod: JOI_PKCE_METHOD.optional(),
  username: Joi.string().optional(),
});

export const createLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { loginSessionCache },
    data: {
      country,
      email,
      flowType,
      identityId,
      nonce,
      phoneNumber,
      pkceChallenge,
      pkceMethod,
      username,
    },
    repository: { accountRepository },
  } = ctx;

  const { expires, expiresIn } = getExpires(configuration.defaults.login_session_expiry);

  let loginSession = new LoginSession({
    country,
    expires,
    identityId,
    pkceChallenge,
    pkceMethod,
  });

  let account: Account | undefined;

  if (identityId) {
    account = await accountRepository.tryFind({ id: identityId });
  }

  loginSession = await resolveAllowedFlows(ctx, loginSession, account);

  if (flowType && !includes(loginSession.allowedFlows, flowType)) {
    throw new ClientError("Invalid Flow Type");
  }

  await loginSessionCache.create(loginSession, expiresIn);

  if (!flowType) {
    return { body: { id: loginSession.id } };
  }

  const flow = await handleFlowInitialisation(ctx, loginSession, {
    email,
    flowType,
    nonce,
    phoneNumber,
    username,
  });

  return { body: { id: loginSession.id, flow } };
};
