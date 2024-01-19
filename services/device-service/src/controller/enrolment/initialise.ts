import {
  RdcSessionMode,
  RdcSessionType,
  SessionStatus,
  SubjectHint,
  TokenType,
} from "@lindorm-io/common-enums";
import {
  InitialiseEnrolmentRequestBody,
  InitialiseEnrolmentResponse,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { RsaKeySet } from "@lindorm-io/jwk";
import { ControllerResponse } from "@lindorm-io/koa";
import { randomString } from "@lindorm-io/random";
import Joi from "joi";
import { JOI_CERTIFICATE_METHOD } from "../../constant";
import { EnrolmentSession } from "../../entity";
import { createRdcSession, getDeviceHeaders, isRdcRequired } from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

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
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  const certificateChallenge = randomString(128);

  const externalChallengeRequired = await isRdcRequired(ctx, identityId);
  const nonce = randomString(16);

  const { installationId, name, uniqueId, systemVersion } = getDeviceHeaders(ctx);

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

  const keySet = RsaKeySet.fromPem({ id: "ignored", publicKey, type: "RSA" });

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
      publicKey: keySet.export("b64").publicKey,
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
    type: TokenType.ENROLMENT,
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
