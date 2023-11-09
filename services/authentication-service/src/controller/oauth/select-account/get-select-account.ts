import {
  GetSelectAccountRequestParams,
  GetSelectAccountResponse,
  SelectAccountDetails,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { getIdentity, getOauthAuthorizationSession } from "../../../handler";
import { ServerKoaController } from "../../../types";

type RequestData = GetSelectAccountRequestParams;

type ResponseBody = GetSelectAccountResponse;

export const getSelectAccountSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getSelectAccountController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id },
  } = ctx;

  const { selectAccount, client, tenant } = await getOauthAuthorizationSession(ctx, id);

  const sessions: Array<SelectAccountDetails> = [];

  for (const session of selectAccount.sessions) {
    const identity = await getIdentity(ctx, session.identityId);

    sessions.push({
      active: identity.active,
      avatarUri: identity.avatarUri,
      identityId: session.identityId,
      name: identity.name,
      picture: identity.picture,
      selectId: session.selectId,
    });
  }

  return {
    body: {
      sessions,
      status: selectAccount.status,
      client,
      tenant,
    },
  };
};
