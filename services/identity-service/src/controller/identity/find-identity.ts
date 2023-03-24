import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { findIdentityWithIdentifier } from "../../handler";
import { removeEmptyFromArray } from "@lindorm-io/core";
import {
  FindIdentityRequestQuery,
  FindIdentityResponse,
  IdentifierType,
} from "@lindorm-io/common-types";

type RequestData = FindIdentityRequestQuery;

type ResponseBody = FindIdentityResponse;

export const findIdentitySchema = Joi.object<RequestData>()
  .keys({
    email: Joi.string(),
    external: Joi.string(),
    nin: Joi.string(),
    phone: Joi.string(),
    provider: Joi.string(),
    ssn: Joi.string(),
    username: Joi.string(),
  })
  .options({ abortEarly: false })
  .required();

export const findIdentityController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { email, external, provider, nin, phone, ssn, username },
    mongo: { identityRepository },
  } = ctx;

  const filtered = removeEmptyFromArray([email, external, nin, phone, ssn, username]);

  if (filtered.length !== 1) {
    throw new ClientError("Invalid selection of query parameters", {
      description:
        "Choose ONE of the following: [ email | external | nin | phone | ssn | username ]",
      debug: { email, external, nin, phone, ssn, username },
    });
  }

  if (email) {
    const identity = await findIdentityWithIdentifier(ctx, {
      type: IdentifierType.EMAIL,
      value: email,
    });

    return { body: { identityId: identity?.id || null } };
  }

  if (phone) {
    const identity = await findIdentityWithIdentifier(ctx, {
      type: IdentifierType.PHONE,
      value: phone,
    });

    return { body: { identityId: identity?.id || null } };
  }

  if (nin) {
    const identity = await findIdentityWithIdentifier(ctx, {
      type: IdentifierType.NIN,
      value: nin,
    });

    return { body: { identityId: identity?.id || null } };
  }

  if (ssn) {
    const identity = await findIdentityWithIdentifier(ctx, {
      type: IdentifierType.SSN,
      value: ssn,
    });

    return { body: { identityId: identity?.id || null } };
  }

  if (external) {
    if (!provider) {
      throw new ClientError("Provider is required", {
        description: "When the query param [ external ] exists [ provider ] is required",
      });
    }

    const identity = await findIdentityWithIdentifier(ctx, {
      provider,
      type: IdentifierType.EXTERNAL,
      value: external,
    });

    return { body: { identityId: identity?.id || null } };
  }

  if (username) {
    const identity = await identityRepository.tryFind({ username });

    return { body: { identityId: identity?.id || null } };
  }

  throw new ClientError("Invalid query parameters");
};
