import Joi from "joi";
import { Algorithm, KeyType, NamedCurve } from "../enum";

export const JOI_KEY_ALGORITHM = Joi.string().valid(
  Algorithm.ES256,
  Algorithm.ES384,
  Algorithm.ES512,
  Algorithm.RS256,
  Algorithm.RS384,
  Algorithm.RS512,
);

export const JOI_KEY_ALGORITHMS = Joi.array().items(JOI_KEY_ALGORITHM);

export const JOI_KEY_NAMED_CURVE = Joi.string().valid(
  NamedCurve.P256,
  NamedCurve.P384,
  NamedCurve.P521,
);

export const JOI_KEY_TYPE = Joi.string().valid(KeyType.EC, KeyType.RSA);
