import { ChallengeStrategy, PSD2Factor, SubjectHint, TokenType } from "@lindorm-io/common-enums";
import {
  ConfirmChallengeRequestBody,
  ConfirmChallengeRequestParams,
  ConfirmChallengeResponse,
} from "@lindorm-io/common-types";
import { CryptoLayered } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { flatten } from "lodash";
import { ChallengeConfirmationTokenClaims, JOI_JWT } from "../../common";
import { JOI_BIOMETRY, JOI_PINCODE, JOI_STRATEGY } from "../../constant";
import { getDeviceHeaders, vaultGetSalt } from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";
import { assertCertificateChallenge } from "../../util";

type RequestData = ConfirmChallengeRequestParams & ConfirmChallengeRequestBody;

type ResponseBody = ConfirmChallengeResponse;

export const confirmChallengeSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    biometry: Joi.when("strategy", {
      is: ChallengeStrategy.BIOMETRY,
      then: JOI_BIOMETRY.required(),
      otherwise: Joi.forbidden(),
    }),
    certificateVerifier: Joi.string().base64().required(),
    challengeSessionToken: JOI_JWT.required(),
    pincode: Joi.when("strategy", {
      is: ChallengeStrategy.PINCODE,
      then: JOI_PINCODE.required(),
      otherwise: Joi.forbidden(),
    }),
    strategy: JOI_STRATEGY.required(),
  })
  .required();

export const confirmChallengeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { challengeSessionCache },
    data: { certificateVerifier, pincode, biometry, strategy },
    entity: { challengeSession, deviceLink, publicKey },
    jwt,
    mongo: { deviceLinkRepository },
    token: { challengeSessionToken },
  } = ctx;

  if (challengeSession.id !== challengeSessionToken.metadata.session) {
    throw new ClientError("Invalid challenge session token");
  }

  if (!challengeSession.strategies.includes(strategy)) {
    throw new ClientError("Invalid strategy");
  }

  const { linkId, installationId, name, uniqueId } = getDeviceHeaders(ctx);

  if (
    deviceLink.id !== linkId ||
    deviceLink.installationId !== installationId ||
    deviceLink.uniqueId !== uniqueId
  ) {
    throw new ClientError("Invalid metadata");
  }

  await assertCertificateChallenge({
    certificateChallenge: challengeSession.certificateChallenge,
    certificateMethod: deviceLink.certificateMethod,
    certificateVerifier,
    publicKey,
  });

  const factors: Array<PSD2Factor> = [PSD2Factor.POSSESSION];

  const salt = await vaultGetSalt(ctx, deviceLink);

  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    hmac: { secret: salt.hmac },
  });

  switch (strategy) {
    case ChallengeStrategy.IMPLICIT:
      break;

    case ChallengeStrategy.PINCODE:
      await crypto.assert(pincode, deviceLink.pincode!);
      factors.push(PSD2Factor.KNOWLEDGE);
      break;

    case ChallengeStrategy.BIOMETRY:
      await crypto.assert(biometry, deviceLink.biometry!);
      factors.push(PSD2Factor.INHERENCE);
      break;

    default:
      throw new ClientError("Invalid strategy", {
        debug: { strategy },
      });
  }

  if (name && name !== deviceLink.name) {
    deviceLink.name = name;

    await deviceLinkRepository.update(deviceLink);
  }

  const { token: challengeConfirmationToken, expiresIn } =
    jwt.sign<ChallengeConfirmationTokenClaims>({
      audiences: flatten([configuration.oauth.client_id, challengeSession.audiences]),
      claims: {
        deviceLinkId: deviceLink.id,
        ext: challengeSession.payload,
        factors,
        strategy,
      },
      expiry: configuration.defaults.challenge_confirmation_token_expiry,
      nonce: challengeSession.nonce,
      scopes: challengeSession.scopes,
      session: challengeSession.id,
      sessionHint: "challenge",
      subject: deviceLink.identityId,
      subjectHint: SubjectHint.IDENTITY,
      type: TokenType.CHALLENGE_CONFIRMATION,
    });

  await challengeSessionCache.destroy(challengeSession);

  return { body: { challengeConfirmationToken, expiresIn } };
};
