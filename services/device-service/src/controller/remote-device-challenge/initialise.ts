import { RdcSessionMode, RdcSessionType } from "@lindorm-io/common-enums";
import {
  InitialiseRdcSessionRequestBody,
  InitialiseRdcSessionResponse,
} from "@lindorm-io/common-types";
import { expiryDate } from "@lindorm-io/expiry";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_NONCE } from "../../common";
import {
  JOI_FACTORS,
  JOI_RDC_CONFIRM_METHOD,
  JOI_RDC_MODE,
  JOI_RDC_REJECT_METHOD,
} from "../../constant";
import { createRdcSession } from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

type RequestData = InitialiseRdcSessionRequestBody;

type ResponseBody = InitialiseRdcSessionResponse;

export const initialiseRdcSchema = Joi.object<RequestData>()
  .keys({
    audiences: Joi.array().items(Joi.string().guid()),
    confirmMethod: JOI_RDC_CONFIRM_METHOD,
    confirmPayload: Joi.object(),
    confirmUri: Joi.string().uri().required(),
    expiresAt: Joi.string(),
    factors: JOI_FACTORS,
    identityId: Joi.when("mode", {
      is: RdcSessionMode.PUSH_NOTIFICATION,
      then: Joi.string().guid().required(),
      otherwise: Joi.forbidden(),
    }),
    mode: JOI_RDC_MODE.required(),
    nonce: JOI_NONCE.required(),
    rejectMethod: JOI_RDC_REJECT_METHOD,
    rejectPayload: Joi.object(),
    rejectUri: Joi.string().uri().required(),
    scopes: Joi.array().items(Joi.string()),
    templateName: Joi.string().required(),
    templateParameters: Joi.object(),
    tokenPayload: Joi.object(),
  })
  .required();

export const initialiseRdcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: {
      audiences,
      confirmPayload,
      confirmMethod,
      confirmUri,
      expiresAt,
      factors,
      identityId,
      mode,
      nonce,
      rejectMethod,
      rejectPayload,
      rejectUri,
      scopes,
      templateName,
      templateParameters,
      tokenPayload,
    },
  } = ctx;

  const rdcSession = await createRdcSession(ctx, {
    audiences,
    confirmMethod,
    confirmPayload,
    confirmUri,
    expires: expiresAt
      ? new Date(expiresAt)
      : expiryDate(configuration.defaults.remote_device_challenge_session_expiry),
    factors,
    identityId,
    mode,
    nonce,
    rejectMethod,
    rejectPayload,
    rejectUri,
    scopes,
    templateName,
    templateParameters,
    tokenPayload,
    type: RdcSessionType.CALLBACK,
  });

  return {
    body: {
      id: rdcSession.id,
      expires: rdcSession.expires.toISOString(),
    },
    status: HttpStatus.Success.ACCEPTED,
  };
};
