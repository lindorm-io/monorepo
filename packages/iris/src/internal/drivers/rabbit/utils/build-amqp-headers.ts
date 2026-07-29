import type { Options } from "amqplib";
import { RABBIT_HEADER_SPECS } from "../../../codec/envelope-field-table.js";
import { encodeScalarHeaders } from "../../../codec/header-map-codec.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type { AmqpPublishParams } from "../types/rabbit-types.js";
import { sanitizeRoutingKey } from "./sanitize-routing-key.js";

export type { AmqpPublishParams };

export const buildAmqpHeaders = (
  envelope: IrisEnvelope,
  userHeaders: Record<string, string>,
  options?: {
    persistent?: boolean;
    mandatory?: boolean;
    messageId?: string;
    type?: string;
  },
): AmqpPublishParams => {
  // Every scalar except topic/priority/timestamp travels as an `x-iris-*` header
  // (via the shared codec) — including the full retry-policy set, so retry
  // policy is producer-authoritative (M2). topic/priority/timestamp ride the
  // AMQP-native slots below.
  const headers: Record<string, string | number> = {
    ...userHeaders,
    ...encodeScalarHeaders(envelope, RABBIT_HEADER_SPECS),
  };

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
