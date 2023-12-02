import {
  ChallengeStrategy,
  PSD2Factor,
  SessionStatus,
  SubjectHint,
  TokenType,
} from "@lindorm-io/common-enums";
import {
  ConfirmEnrolmentRequestBody,
  ConfirmEnrolmentRequestParams,
  ConfirmEnrolmentResponse,
} from "@lindorm-io/common-types";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { randomString } from "@lindorm-io/random";
import Joi from "joi";
import { flatten } from "lodash";
import { ChallengeConfirmationTokenClaims, JOI_JWT } from "../../common";
import { JOI_BIOMETRY, JOI_PINCODE } from "../../constant";
import { DeviceLink, PublicKey } from "../../entity";
import { createDeviceLinkCallback } from "../../handler";
import { configuration } from "../../server/configuration";
import { DeviceLinkSalt, ServerKoaController } from "../../types";
import { assertCertificateChallenge } from "../../util";

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
    mongo: { deviceLinkRepository, publicKeyRepository },
    token: { bearerToken, enrolmentSessionToken },
  } = ctx;

  if (enrolmentSession.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  if (enrolmentSession.id !== enrolmentSessionToken.metadata.session) {
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
    aes: randomString(32),
    hmac: randomString(32),
  };

  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    hmac: { secret: salt.hmac },
  });

  const publicKey = await publicKeyRepository.create(
    new PublicKey({
      key: enrolmentSession.publicKey,
    }),
  );

  const deviceLink = await deviceLinkRepository.create(
    new DeviceLink({
      active: true,
      biometry: biometry ? await crypto.sign(biometry) : undefined,
      certificateMethod: enrolmentSession.certificateMethod,
      identityId: enrolmentSession.identityId,
      installationId: enrolmentSession.installationId,
      metadata: enrolmentSession.deviceMetadata,
      name: enrolmentSession.name,
      pincode: pincode ? await crypto.sign(pincode) : undefined,
      publicKeyId: publicKey.id,
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
      type: TokenType.CHALLENGE_CONFIRMATION,
    });

  await enrolmentSessionCache.destroy(enrolmentSession);

  return {
    body: {
      challengeConfirmationToken,
      deviceLinkId: deviceLink.id,
      expiresIn,
      publicKeyId: publicKey.id,
      trusted,
    },
  };
};
