import Joi from "joi";
import { ChallengeConfirmationTokenClaims, Context } from "../../types";
import { ClientError } from "@lindorm-io/errors";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_BIOMETRY, JOI_PINCODE, JOI_STRATEGY } from "../../constant";
import { JOI_GUID, JOI_JWT, SubjectHint } from "../../common";
import { TokenType, ChallengeStrategy, Factor } from "../../enum";
import { assertCertificateChallenge } from "../../util";
import { configuration } from "../../configuration";
import { CryptoLayered } from "@lindorm-io/crypto";

interface RequestData {
  id: string;
  biometry: string;
  certificateVerifier: string;
  challengeSessionToken: string;
  pincode: string;
  strategy: ChallengeStrategy;
}

interface ResponseBody {
  challengeConfirmationToken: string;
  expiresIn: number;
}

export const confirmChallengeSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
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
});

export const confirmChallengeController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { challengeSessionCache },
    data: { certificateVerifier, pincode, biometry, strategy },
    entity: { challengeSession, deviceLink },
    jwt,
    metadata: {
      device: { name },
    },
    repository: { deviceLinkRepository },
  } = ctx;

  await assertCertificateChallenge({
    certificateChallenge: challengeSession.certificateChallenge,
    certificateMethod: deviceLink.certificateMethod,
    certificateVerifier,
    publicKey: deviceLink.publicKey,
  });

  const factors: Array<Factor> = [Factor.POSSESSION];

  const crypto = new CryptoLayered({
    aes: { secret: deviceLink.salt.aes },
    sha: { secret: deviceLink.salt.sha },
  });

  switch (strategy) {
    case ChallengeStrategy.IMPLICIT:
      break;

    case ChallengeStrategy.PINCODE:
      await crypto.assert(pincode, deviceLink.pincode);
      factors.push(Factor.KNOWLEDGE);
      break;

    case ChallengeStrategy.BIOMETRY:
      await crypto.assert(biometry, deviceLink.biometry);
      factors.push(Factor.INHERENCE);
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

  const { expiresIn, token } = jwt.sign<Record<string, unknown>, ChallengeConfirmationTokenClaims>({
    audiences: [challengeSession.clientId],
    claims: {
      deviceLinkId: deviceLink.id,
      factors,
      strategy,
    },
    expiry: configuration.expiry.challenge_confirmation_token,
    nonce: challengeSession.nonce,
    payload: challengeSession.payload,
    scopes: challengeSession.scopes,
    sessionId: challengeSession.id,
    subject: deviceLink.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_CONFIRMATION_TOKEN,
  });

  await challengeSessionCache.destroy(challengeSession);

  return {
    body: {
      challengeConfirmationToken: token,
      expiresIn,
    },
  };
};
