import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { RdcSessionMode } from "../../common";
import { RdcSessionType } from "../../enum";
import { configuration } from "../../configuration";
import { createRdcSession } from "../../handler";
import { getExpiryDate } from "@lindorm-io/core";
import {
  JOI_FACTORS,
  JOI_RDC_CONFIRM_METHOD,
  JOI_RDC_MODE,
  JOI_RDC_REJECT_METHOD,
} from "../../constant";
import {
  InitialiseRdcSessionRequestData,
  InitialiseRdcSessionResponseBody,
  JOI_GUID,
  JOI_NONCE,
} from "../../common";

export const initialiseRdcSchema = Joi.object<InitialiseRdcSessionRequestData>({
  clientId: JOI_GUID.required(),
  confirmMethod: JOI_RDC_CONFIRM_METHOD.optional(),
  confirmPayload: Joi.object().optional(),
  confirmUri: Joi.string().uri().required(),
  expiresAt: Joi.string().optional(),
  factors: JOI_FACTORS.optional(),
  identityId: Joi.when("mode", {
    is: RdcSessionMode.PUSH_NOTIFICATION,
    then: JOI_GUID.required(),
    otherwise: JOI_GUID.optional(),
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
});

export const initialiseRdcController: Controller<Context<InitialiseRdcSessionRequestData>> = async (
  ctx,
): ControllerResponse<InitialiseRdcSessionResponseBody> => {
  const {
    data: {
      clientId,
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
    clientId,
    confirmMethod,
    confirmPayload,
    confirmUri,
    expires: expiresAt
      ? new Date(expiresAt)
      : getExpiryDate(configuration.expiry.remote_device_challenge_session),
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
      id,
      expiresIn,
    },
    status: HttpStatus.Success.ACCEPTED,
  };
};
