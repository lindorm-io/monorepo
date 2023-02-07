import Joi from "joi";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createRdcSession } from "../../handler";
import { expiryDate } from "@lindorm-io/expiry";
import { JOI_NONCE } from "../../common";
import {
  InitialiseRdcSessionRequestBody,
  InitialiseRdcSessionResponse,
  RdcSessionModes,
  RdcSessionTypes,
} from "@lindorm-io/common-types";
import {
  JOI_FACTORS,
  JOI_RDC_CONFIRM_METHOD,
  JOI_RDC_MODE,
  JOI_RDC_REJECT_METHOD,
} from "../../constant";

type RequestData = InitialiseRdcSessionRequestBody;

type ResponseBody = InitialiseRdcSessionResponse;

export const initialiseRdcSchema = Joi.object<RequestData>()
  .keys({
    audiences: Joi.array().items(Joi.string().guid()).optional(),
    confirmMethod: JOI_RDC_CONFIRM_METHOD.optional(),
    confirmPayload: Joi.object().optional(),
    confirmUri: Joi.string().uri().required(),
    expiresAt: Joi.string().optional(),
    factors: JOI_FACTORS.optional(),
    identityId: Joi.when("mode", {
      is: RdcSessionModes.PUSH_NOTIFICATION,
      then: Joi.string().guid().required(),
      otherwise: Joi.string().guid().optional(),
    }),
    mode: JOI_RDC_MODE.required(),
    nonce: JOI_NONCE.required(),
    rejectMethod: JOI_RDC_REJECT_METHOD.optional(),
    rejectPayload: Joi.object().optional(),
    rejectUri: Joi.string().uri().required(),
    scopes: Joi.array().items(Joi.string()).optional(),
    templateName: Joi.string().required(),
    templateParameters: Joi.object().optional(),
    tokenPayload: Joi.object().optional(),
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

  const { id, expiresIn } = await createRdcSession(ctx, {
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
    type: RdcSessionTypes.CALLBACK,
  });

  return { body: { id, expiresIn }, status: HttpStatus.Success.ACCEPTED };
};
