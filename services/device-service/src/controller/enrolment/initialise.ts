import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { EnrolmentSession } from "../../entity";
import { JOI_CERTIFICATE_METHOD } from "../../constant";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createRdcSession, isRdcRequired } from "../../handler";
import { expiryDate } from "@lindorm-io/expiry";
import { randomString } from "@lindorm-io/random";
import {
  DeviceTokenType,
  InitialiseEnrolmentRequestBody,
  InitialiseEnrolmentResponse,
  RdcSessionMode,
  RdcSessionType,
  SessionStatus,
  SubjectHint,
} from "@lindorm-io/common-types";

type RequestData = InitialiseEnrolmentRequestBody;

type ResponseBody = InitialiseEnrolmentResponse;

export const initialiseEnrolmentSchema = Joi.object<RequestData>()
  .keys({
    audiences: Joi.array().items(Joi.string().guid()).optional(),
    brand: Joi.string().required(),
    buildId: Joi.string().required(),
    buildNumber: Joi.string().required(),
    certificateMethod: JOI_CERTIFICATE_METHOD.required(),
    macAddress: Joi.string().required(),
    model: Joi.string().required(),
    publicKey: Joi.string().required(),
    systemName: Joi.string().required(),
  })
  .required();

export const initialiseEnrolmentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { enrolmentSessionCache },
    data: {
      audiences,
      brand,
      buildId,
      buildNumber,
      certificateMethod,
      macAddress,
      model,
      publicKey,
      systemName,
    },
    jwt,
    metadata: {
      device: { installationId, name, uniqueId, systemVersion },
    },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const certificateChallenge = randomString(128);

  const externalChallengeRequired = await isRdcRequired(ctx, identityId);
  const nonce = randomString(16);

  if (!name || !installationId || !uniqueId) {
    throw new ClientError("Invalid metadata", {
      description: "Metadata is required to continue enrolment",
      data: {
        name,
        installationId,
        uniqueId,
      },
    });
  }

  const enrolmentSession = await enrolmentSessionCache.create(
    new EnrolmentSession({
      audiences,
      certificateChallenge,
      certificateMethod,
      deviceMetadata: {
        brand,
        buildId,
        buildNumber,
        macAddress,
        model,
        systemName,
      },
      name,
      expires: expiryDate(configuration.defaults.enrolment_session_expiry),
      identityId,
      installationId,
      nonce,
      publicKey,
      status: externalChallengeRequired ? SessionStatus.PENDING : SessionStatus.SKIP,
      uniqueId,
    }),
  );

  const { token } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.enrolment_session_expiry,
    session: enrolmentSession.id,
    sessionHint: "enrolment",
    subject: identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: DeviceTokenType.ENROLMENT_SESSION,
  });

  if (externalChallengeRequired) {
    await createRdcSession(ctx, {
      audiences,
      enrolmentSessionId: enrolmentSession.id,
      expires: enrolmentSession.expires,
      factors: 2,
      identityId,
      mode: RdcSessionMode.QR_CODE,
      nonce,
      templateName: "enrolment",
      templateParameters: {
        brand,
        model,
        name,
        systemName,
        systemVersion,
      },
      type: RdcSessionType.ENROLMENT,
    });
  }

  return {
    body: {
      certificateChallenge,
      enrolmentSessionId: enrolmentSession.id,
      enrolmentSessionToken: token,
      expires: enrolmentSession.expires.toISOString(),
      externalChallengeRequired,
    },
  };
};
