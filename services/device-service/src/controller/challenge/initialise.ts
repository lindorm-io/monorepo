import Joi from "joi";
import { ChallengeSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_NONCE } from "../../common";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { expiryObject } from "@lindorm-io/expiry";
import { randomString } from "@lindorm-io/random";
import { sortedUniq } from "lodash";
import {
  ChallengeStrategies,
  ChallengeStrategy,
  InitialiseChallengeRequestBody,
  InitialiseChallengeResponse,
  LindormTokenTypes,
  SubjectHints,
} from "@lindorm-io/common-types";

type RequestData = InitialiseChallengeRequestBody;

type ResponseBody = InitialiseChallengeResponse;

export const initialiseChallengeSchema = Joi.object<RequestData>()
  .keys({
    audiences: Joi.array().items(Joi.string().guid()).optional(),
    deviceLinkId: Joi.string().guid().required(),
    identityId: Joi.string().guid().required(),
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

  const strategies: Array<ChallengeStrategy> = [ChallengeStrategies.IMPLICIT];

  if (deviceLink.biometry) {
    strategies.push(ChallengeStrategies.BIOMETRY);
  }

  if (deviceLink.pincode) {
    strategies.push(ChallengeStrategies.PINCODE);
  }

  const certificateChallenge = randomString(128);
  const { expires, expiresIn } = expiryObject(configuration.defaults.challenge_session_expiry);

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
    subjectHint: SubjectHints.IDENTITY,
    type: LindormTokenTypes.CHALLENGE_SESSION,
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
