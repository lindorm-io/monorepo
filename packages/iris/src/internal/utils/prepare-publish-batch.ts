import type { IMessage } from "../../interfaces";
import type { PublishOptions } from "../../types";
import type { MessageMetadata } from "../message/types/metadata";
import type { OutboundPayload } from "../message/utils/prepare-outbound";
import type { IrisEnvelope } from "../types/iris-envelope";
import { buildEnvelope, type EnvelopeOverrides } from "./build-envelope";
import { resolveDelay } from "../message/utils/resolve-delay";
import { resolveExpiry } from "../message/utils/resolve-expiry";
import { resolveIdentifierValue } from "./resolve-identifier-value";
import { resolvePriority } from "../message/utils/resolve-priority";
import { resolveTopic } from "../message/utils/resolve-topic";

export type PublishDriverLike<M extends IMessage> = {
  prepareForPublish: (message: M) => Promise<OutboundPayload>;
  completePublish: (message: M) => Promise<void>;
  metadata: MessageMetadata;
};

export type PreparedMessage<M extends IMessage> = {
  message: M;
  envelope: IrisEnvelope;
  outbound: OutboundPayload;
  topic: string;
  delayed: boolean;
  delay: number;
};

export const preparePublishBatch = async <M extends IMessage>(
  messages: M | Array<M>,
  options: PublishOptions | undefined,
  driver: PublishDriverLike<M>,
): Promise<Array<PreparedMessage<M>>> => {
  const arr = Array.isArray(messages) ? messages : [messages];
  const priority = resolvePriority(options, driver.metadata);
  const expiry = resolveExpiry(options, driver.metadata);
  const delay = resolveDelay(options, driver.metadata);

  const prepared: Array<PreparedMessage<M>> = [];

  for (const message of arr) {
    const outbound = await driver.prepareForPublish(message);
    const topic = resolveTopic(message, driver.metadata);

    if (options?.headers) {
      Object.assign(outbound.headers, options.headers);
    }

    if (priority > 0) {
      outbound.headers["x-iris-priority"] = String(priority);
    }

    const identifierValue = resolveIdentifierValue(message, driver.metadata);

    const envelopeOverrides: EnvelopeOverrides = { priority, identifierValue };
    if (expiry !== null) {
      envelopeOverrides.expiry = expiry;
    }

    const envelope = buildEnvelope(outbound, topic, driver.metadata, envelopeOverrides);

    prepared.push({
      message,
      envelope,
      outbound,
      topic,
      delayed: delay > 0,
      delay,
    });
  }

  return prepared;
};
