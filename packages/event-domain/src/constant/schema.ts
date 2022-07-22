import Joi from "joi";
import { AggregateIdentifier, IMessage } from "../types";
import { MessageType } from "../enum";
import { ISubscription } from "@lindorm-io/amqp";

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
  routingKey: Joi.string().required(),
  timestamp: Joi.date().required(),
  type: Joi.string()
    .allow(MessageType.COMMAND, MessageType.DOMAIN_EVENT, MessageType.TIMEOUT_EVENT)
    .required(),
});

export const JOI_SUBSCRIPTION = Joi.object<ISubscription>().keys({
  callback: Joi.function().required(),
  queue: Joi.string().required(),
  routingKey: Joi.string().required(),
});
