import Joi from "joi";
import { AggregateIdentifier, IMessage } from "../types";
import { MessageType } from "../enum";

export const JOI_MESSAGE = Joi.object<IMessage>().keys({
  id: Joi.string().guid().required(),
  aggregate: Joi.object<AggregateIdentifier>()
    .keys({
      id: Joi.string().required(),
      name: Joi.string().required(),
      context: Joi.string().required(),
    })
    .required(),
  causationId: Joi.string().guid().required(),
  correlationId: Joi.string().guid().required(),
  data: Joi.object().required(),
  delay: Joi.number().required(),
  mandatory: Joi.boolean().required(),
  name: Joi.string().required(),
  origin: Joi.string().required(),
  originId: Joi.string().allow(null).required(),
  topic: Joi.string().required(),
  timestamp: Joi.date().required(),
  type: Joi.string()
    .allow(
      MessageType.COMMAND,
      MessageType.DOMAIN_EVENT,
      MessageType.ERROR_MESSAGE,
      MessageType.REPLAY_MESSAGE,
      MessageType.TIMEOUT_MESSAGE,
    )
    .required(),
  version: Joi.number().required(),
});
