import Joi from "joi";
import { ChallengeSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_NONCE, ChallengeStrategy, SubjectHint, TokenType } from "../../common";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { getExpires, randomString } from "@lindorm-io/core";
import { sortedUniq } from "lodash";

interface RequestData {
  audiences?: Array<string>;
  deviceLinkId: string;
  identityId: string;
  nonce: string;
  payload: Record<string, any>;
  scopes: Array<string>;
}

interface ResponseBody {
  certificateChallenge: string;
  challengeSessionId: string;
  challengeSessionToken: string;
  expiresIn: number;
  strategies: Array<ChallengeStrategy>;
}

export const initialiseChallengeSchema = Joi.object<RequestData>()
  .keys({
    audiences: Joi.array().items(JOI_GUID).optional(),
    deviceLinkId: JOI_GUID.required(),
    identityId: JOI_GUID.required(),
    nonce: JOI_NONCE.required(),
    payload: Joi.object().required(),
    scopes: Joi.array().items(Joi.string()).required(),
  })
  .required();

export const initialiseChallengeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { challengeSessionCache },
    data: { audiences, nonce, payload, scopes },
    entity: { deviceLink },
    jwt,
  } = ctx;

  const strategies: Array<ChallengeStrategy> = [ChallengeStrategy.IMPLICIT];

  if (deviceLink.biometry) {
    strategies.push(ChallengeStrategy.BIOMETRY);
  }

  if (deviceLink.pincode) {
    strategies.push(ChallengeStrategy.PINCODE);
  }

  const certificateChallenge = randomString(128);
  const { expires, expiresIn } = getExpires(configuration.defaults.challenge_session_expiry);

  const session = await challengeSessionCache.create(
    new ChallengeSession({
      certificateChallenge,
      audiences,
      deviceLinkId: deviceLink.id,
      expires,
      nonce,
      payload,
      scopes,
      strategies,
    }),
  );

  const { token } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.challenge_session_expiry,
    sessionId: session.id,
    subject: deviceLink.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_SESSION,
  });

  return {
    body: {
      certificateChallenge,
      challengeSessionId: session.id,
      challengeSessionToken: token,
      expiresIn,
      strategies: sortedUniq(strategies),
    },
  };
};
