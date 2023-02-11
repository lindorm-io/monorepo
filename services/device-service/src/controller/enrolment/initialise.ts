import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { EnrolmentSession } from "../../entity";
import { JOI_CERTIFICATE_METHOD } from "../../constant";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createRdcSession, isRdcRequired } from "../../handler";
import { expiryObject } from "@lindorm-io/expiry";
import { randomString } from "@lindorm-io/random";
import {
  InitialiseEnrolmentRequestBody,
  InitialiseEnrolmentResponse,
  LindormTokenTypes,
  RdcSessionModes,
  RdcSessionTypes,
  SessionStatuses,
  SubjectHints,
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
    cache: { enrolmentSessionCache },
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

  const { expires, expiresIn } = expiryObject(configuration.defaults.enrolment_session_expiry);

  const externalChallengeRequired = await isRdcRequired(ctx, identityId);
  const nonce = randomString(16);

  if (!name || !installationId || !uniqueId) {
    throw new ClientError("Bad Request", {
      description: "Missing metadata",
      data: {
        name,
        installationId,
        uniqueId,
      },
    });
  }

  const session = await enrolmentSessionCache.create(
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
      expires,
      identityId,
      installationId,
      nonce,
      publicKey,
      status: externalChallengeRequired ? SessionStatuses.PENDING : SessionStatuses.SKIP,
      uniqueId,
    }),
  );

  const { token } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.enrolment_session_expiry,
    sessionId: session.id,
    subject: identityId,
    subjectHint: SubjectHints.IDENTITY,
    type: LindormTokenTypes.ENROLMENT_SESSION,
  });

  if (externalChallengeRequired) {
    await createRdcSession(ctx, {
      audiences,
      enrolmentSessionId: session.id,
      expires,
      factors: 2,
      identityId,
      mode: RdcSessionModes.QR_CODE,
      nonce,
      templateName: "enrolment",
      templateParameters: {
        brand,
        model,
        name,
        systemName,
        systemVersion,
      },
      type: RdcSessionTypes.ENROLMENT,
    });
  }

  return {
    body: {
      certificateChallenge,
      enrolmentSessionId: session.id,
      enrolmentSessionToken: token,
      expiresIn,
      externalChallengeRequired,
    },
  };
};
