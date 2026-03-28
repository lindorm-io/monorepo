import type { Options } from "amqplib";
import type { IrisEnvelope } from "../../../types/iris-envelope";
import type { AmqpPublishConfig } from "../types/rabbit-types";
import { sanitizeRoutingKey } from "./sanitize-routing-key";

export type { AmqpPublishConfig };

export const buildAmqpHeaders = (
  envelope: IrisEnvelope,
  userHeaders: Record<string, string>,
  options?: {
    persistent?: boolean;
    mandatory?: boolean;
    messageId?: string;
    type?: string;
  },
): AmqpPublishConfig => {
  const headers: Record<string, string | number> = { ...userHeaders };

  headers["x-iris-attempt"] = envelope.attempt;
  if (envelope.correlationId) headers["x-iris-correlation-id"] = envelope.correlationId;
  if (envelope.replyTo) headers["x-iris-reply-to"] = envelope.replyTo;
  if (envelope.expiry !== null) headers["x-iris-expiry"] = envelope.expiry;
  if (envelope.broadcast) headers["x-iris-broadcast"] = "true";

  const properties: Options.Publish = {
    headers,
    persistent: options?.persistent ?? true,
    timestamp: envelope.timestamp,
    priority: envelope.priority || undefined,
    messageId: options?.messageId,
    type: options?.type,
    correlationId: envelope.correlationId ?? undefined,
    mandatory: options?.mandatory,
  };

  return {
    properties,
    routingKey: sanitizeRoutingKey(envelope.topic),
  };
};
