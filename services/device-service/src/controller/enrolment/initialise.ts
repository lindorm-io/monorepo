import Joi from "joi";
import { CertificateMethod } from "../../enum";
import { ControllerResponse } from "@lindorm-io/koa";
import { EnrolmentSession } from "../../entity";
import { JOI_CERTIFICATE_METHOD } from "../../constant";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createRdcSession, isRdcRequired } from "../../handler";
import { getExpires } from "@lindorm-io/core";
import { randomString } from "@lindorm-io/core";
import {
  JOI_GUID,
  RdcSessionMode,
  RdcSessionType,
  SessionStatus,
  SubjectHint,
  TokenType,
} from "../../common";

interface RequestData {
  audiences?: Array<string>;
  brand: string | null;
  buildId: string | null;
  buildNumber: string | null;
  certificateMethod: CertificateMethod;
  macAddress: string | null;
  model: string | null;
  publicKey: string;
  systemName: string | null;
}

interface ResponseBody {
  certificateChallenge: string;
  enrolmentSessionId: string;
  enrolmentSessionToken: string;
  expiresIn: number;
  externalChallengeRequired: boolean;
}

export const initialiseEnrolmentSchema = Joi.object<RequestData>()
  .keys({
    audiences: Joi.array().items(JOI_GUID).optional(),
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

  const { expires, expiresIn } = getExpires(configuration.defaults.enrolment_session_expiry);

  const externalChallengeRequired = await isRdcRequired(ctx, identityId);
  const nonce = randomString(16);

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
      status: externalChallengeRequired ? SessionStatus.PENDING : SessionStatus.SKIP,
      uniqueId,
    }),
  );

  const { token } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.enrolment_session_expiry,
    sessionId: session.id,
    subject: identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ENROLMENT_SESSION,
  });

  if (externalChallengeRequired) {
    await createRdcSession(ctx, {
      audiences,
      enrolmentSessionId: session.id,
      expires,
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
      enrolmentSessionId: session.id,
      enrolmentSessionToken: token,
      expiresIn,
      externalChallengeRequired,
    },
  };
};
