import Joi from "joi";
import { ChallengeConfirmationTokenClaims, JOI_JWT } from "../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { DeviceLink } from "../../entity";
import { DeviceLinkSalt, ServerKoaController } from "../../types";
import { JOI_BIOMETRY, JOI_PINCODE } from "../../constant";
import { assertCertificateChallenge } from "../../util";
import { configuration } from "../../server/configuration";
import { createDeviceLinkCallback } from "../../handler";
import { flatten } from "lodash";
import { randomString } from "@lindorm-io/random";
import { ClientError } from "@lindorm-io/errors";
import {
  ChallengeStrategy,
  ConfirmEnrolmentRequestBody,
  ConfirmEnrolmentRequestParams,
  ConfirmEnrolmentResponse,
  DeviceTokenType,
  PSD2Factor,
  SessionStatus,
  SubjectHint,
} from "@lindorm-io/common-types";

type RequestData = ConfirmEnrolmentRequestParams & ConfirmEnrolmentRequestBody;

type ResponseBody = ConfirmEnrolmentResponse;

export const confirmEnrolmentSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    biometry: JOI_BIOMETRY.optional(),
    certificateVerifier: Joi.string().base64().required(),
    enrolmentSessionToken: JOI_JWT.required(),
    pincode: JOI_PINCODE.optional(),
  })
  .required();

export const confirmEnrolmentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { enrolmentSessionCache },
    data: { biometry, certificateVerifier, pincode },
    entity: { enrolmentSession },
    jwt,
    mongo: { deviceLinkRepository },
    token: { bearerToken, enrolmentSessionToken },
  } = ctx;

  if (enrolmentSession.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  if (enrolmentSession.id !== enrolmentSessionToken.session) {
    throw new ClientError("Invalid enrolment token");
  }

  await assertCertificateChallenge({
    certificateChallenge: enrolmentSession.certificateChallenge,
    certificateMethod: enrolmentSession.certificateMethod,
    certificateVerifier,
    publicKey: enrolmentSession.publicKey,
  });

  const trusted =
    enrolmentSession.status === SessionStatus.CONFIRMED ||
    enrolmentSession.status === SessionStatus.SKIP;

  const salt: DeviceLinkSalt = {
    aes: randomString(128),
    sha: randomString(128),
  };
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  const deviceLink = await deviceLinkRepository.create(
    new DeviceLink({
      active: true,
      biometry: biometry ? await crypto.encrypt(biometry) : undefined,
      certificateMethod: enrolmentSession.certificateMethod,
      identityId: enrolmentSession.identityId,
      installationId: enrolmentSession.installationId,
      metadata: enrolmentSession.deviceMetadata,
      name: enrolmentSession.name,
      pincode: pincode ? await crypto.encrypt(pincode) : undefined,
      publicKey: enrolmentSession.publicKey,
      trusted,
      uniqueId: enrolmentSession.uniqueId,
    }),
    createDeviceLinkCallback(ctx, salt),
  );

  const { token: challengeConfirmationToken, expiresIn } =
    jwt.sign<ChallengeConfirmationTokenClaims>({
      audiences: flatten([configuration.oauth.client_id, enrolmentSession.audiences]),
      claims: {
        deviceLinkId: deviceLink.id,
        ext: {},
        factors: [PSD2Factor.POSSESSION],
        strategy: ChallengeStrategy.IMPLICIT,
      },
      expiry: configuration.defaults.challenge_confirmation_token_expiry,
      nonce: enrolmentSession.nonce,
      scopes: ["enrolment"],
      session: enrolmentSession.id,
      sessionHint: "enrolment",
      subject: deviceLink.identityId,
      subjectHint: SubjectHint.IDENTITY,
      type: DeviceTokenType.CHALLENGE_CONFIRMATION,
    });

  await enrolmentSessionCache.destroy(enrolmentSession);

  return {
    body: {
      challengeConfirmationToken,
      deviceLinkId: deviceLink.id,
      expiresIn,
      trusted,
    },
  };
};
