import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import {
  FindIdentityRequestQuery,
  FindIdentityResponse,
  VerifyPasswordRequestBody,
  VerifyPasswordResponse,
} from "@lindorm-io/common-types";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { randomHex } from "@lindorm-io/random";
import Joi from "joi";
import { fetchAccountSalt } from "../../handler";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaController } from "../../types";

type RequestData = VerifyPasswordRequestBody;

type ResponseData = VerifyPasswordResponse;

export const resolvePasswordGrantSchema = Joi.object<RequestData>()
  .keys({
    username: Joi.string().required(),
    password: Joi.string().required(),
  })
  .required();

export const resolvePasswordGrantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseData> => {
  const {
    axios: { identityClient },
    data: { username, password },
    mongo: { accountRepository },
  } = ctx;

  const {
    data: { identityId },
  } = await identityClient.get<FindIdentityResponse, never, never, FindIdentityRequestQuery>(
    "/admin/find",
    {
      query: { username },
      middleware: [clientCredentialsMiddleware()],
    },
  );

  if (!identityId) {
    throw new ClientError("Invalid login", {
      debug: { username },
      description: "Username or password is invalid",
      statusCode: ClientError.StatusCode.BAD_REQUEST,
    });
  }

  const account = await accountRepository.tryFind({ id: identityId });

  if (!account) {
    throw new ClientError("Invalid login", {
      debug: { account },
      description: "Username or password is invalid",
      statusCode: ClientError.StatusCode.BAD_REQUEST,
    });
  }

  if (!account.password) {
    throw new ClientError("Invalid login", {
      debug: { password },
      description: "Username or password is invalid",
      statusCode: ClientError.StatusCode.BAD_REQUEST,
    });
  }

  const salt = await fetchAccountSalt(ctx, account);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    hmac: { secret: salt.hmac },
  });

  try {
    await crypto.assert(password, account.password);
  } catch (err: any) {
    throw new ClientError("Invalid login", {
      debug: { password },
      error: err,
      description: "Username or password is invalid",
      statusCode: ClientError.StatusCode.BAD_REQUEST,
    });
  }

  return {
    body: {
      factors: [AuthenticationFactor.ONE_FACTOR],
      identityId,
      latestAuthentication: new Date().toISOString(),
      levelOfAssurance: 1,
      methods: [AuthenticationMethod.PASSWORD],
      nonce: randomHex(16),
      strategies: [AuthenticationStrategy.PASSWORD],
    },
  };
};
