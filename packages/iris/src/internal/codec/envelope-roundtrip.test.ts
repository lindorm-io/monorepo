// Cross-driver envelope wire-codec parity.
//
// Every driver serializes and parses through the ONE shared codec (canonical
// field table + a transport adapter). This suite proves the round-trip
// (serialize → deserialize → deep-equal) holds for ALL envelope fields —
// including empty / null / edge values — on every transport, and pins the two
// intentional cross-driver differences:
//   - identifierValue survives ONLY on Kafka (its partition key); nats/redis/
//     rabbit drop it to null (M12).
//   - Rabbit carries topic/priority/timestamp in AMQP-native slots, everything
//     else (incl. the full retry policy) in x-iris headers (M2).

import type { ConsumeMessage } from "amqplib";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import type { KafkaEachMessagePayload } from "../drivers/kafka/types/kafka-types.js";
import { parseKafkaMessage } from "../drivers/kafka/utils/parse-kafka-message.js";
import { serializeKafkaMessage } from "../drivers/kafka/utils/serialize-kafka-message.js";
import { parseNatsMessage } from "../drivers/nats/utils/parse-nats-message.js";
import { serializeNatsMessage } from "../drivers/nats/utils/serialize-nats-message.js";
import { parseStreamEntry } from "../drivers/redis/utils/parse-stream-entry.js";
import { serializeStreamFields } from "../drivers/redis/utils/serialize-stream-fields.js";
import { buildAmqpHeaders } from "../drivers/rabbit/utils/build-amqp-headers.js";
import { buildRabbitEnvelope } from "../drivers/rabbit/utils/build-rabbit-envelope.js";
import { parseAmqpHeaders } from "../drivers/rabbit/utils/parse-amqp-headers.js";
import { describe, expect, it } from "vitest";

const base: IrisEnvelope = {
  topic: "orders.created",
  payload: Buffer.from('{"hello":"world"}'),
  headers: { "x-trace-id": "abc-123" },
  priority: 0,
  timestamp: 1700000000000,
  expiry: null,
  broadcast: false,
  attempt: 0,
  maxRetries: 0,
  retryStrategy: "constant",
  retryDelay: 1000,
  retryDelayMax: 30000,
  retryMultiplier: 2,
  retryJitter: false,
  replyTo: null,
  correlationId: null,
  identifierValue: null,
};

const cases: Record<string, IrisEnvelope> = {
  minimal: base,
  "fully-populated": {
    ...base,
    topic: "billing.invoice.paid",
    headers: { "x-trace-id": "t-1", "x-user-id": "u-9" },
    priority: 7,
    timestamp: 1700009999000,
    expiry: 60000,
    broadcast: true,
    attempt: 3,
    maxRetries: 5,
    retryStrategy: "exponential",
    retryDelay: 500,
    retryDelayMax: 10000,
    retryMultiplier: 3,
    retryJitter: true,
    replyTo: "reply.queue",
    correlationId: "corr-456",
    identifierValue: "order-abc-123",
  },
  "edge-zero-and-empty": {
    ...base,
    priority: 0,
    timestamp: 0,
    expiry: 0, // zero is a real expiry, distinct from null
    attempt: 0,
    headers: {},
    payload: Buffer.alloc(0),
    retryStrategy: "linear",
  },
  "nullable-set": {
    ...base,
    expiry: null,
    replyTo: "reply.only",
    correlationId: "corr-only",
    identifierValue: "id-only",
  },
};

/** Deep-equal helper that tolerates the per-transport identifierValue rule. */
const expectRoundTrip = (
  original: IrisEnvelope,
  parsed: IrisEnvelope,
  identifierValueSurvives: boolean,
) => {
  const expected: IrisEnvelope = {
    ...original,
    identifierValue: identifierValueSurvives ? original.identifierValue : null,
  };
  // Compare payload bytes explicitly (Buffer identity differs across transports).
  expect(parsed.payload.equals(expected.payload)).toBe(true);
  const { payload: _p1, ...parsedRest } = parsed;
  const { payload: _p2, ...expectedRest } = expected;
  expect(parsedRest).toEqual(expectedRest);
};

describe("envelope wire-codec round-trip parity", () => {
  describe("kafka (header-map)", () => {
    for (const [name, envelope] of Object.entries(cases)) {
      it(`round-trips: ${name}`, () => {
        const serialized = serializeKafkaMessage(envelope);
        // Real Kafka delivers headers and key as Buffers — mirror that.
        const headers: Record<string, Buffer | undefined> = {};
        for (const [k, v] of Object.entries(serialized.headers ?? {})) {
          headers[k] = Buffer.from(String(v));
        }
        const key = serialized.key == null ? null : Buffer.from(serialized.key as string);
        const payload: KafkaEachMessagePayload = {
          topic: envelope.topic,
          partition: 0,
          message: {
            key,
            value: serialized.value,
            headers,
            offset: "0",
            timestamp: String(envelope.timestamp),
          },
          heartbeat: async () => {},
        };
        // Kafka keeps identifierValue as its partition key.
        expectRoundTrip(envelope, parseKafkaMessage(payload), true);
      });
    }
  });

  describe("nats (json-body)", () => {
    const headersInit = () => {
      const store = new Map<string, string>();
      return {
        get: (k: string) => store.get(k) ?? "",
        set: (k: string, v: string) => void store.set(k, v),
        has: (k: string) => store.has(k),
        values: (k: string) => (store.has(k) ? [store.get(k)!] : []),
      };
    };
    for (const [name, envelope] of Object.entries(cases)) {
      it(`round-trips: ${name}`, () => {
        const { data } = serializeNatsMessage(envelope, headersInit);
        expectRoundTrip(envelope, parseNatsMessage(data), false);
      });
    }
  });

  describe("redis (flat-hash)", () => {
    for (const [name, envelope] of Object.entries(cases)) {
      it(`round-trips: ${name}`, () => {
        const fields = serializeStreamFields(envelope);
        const entry = parseStreamEntry("1-0", fields);
        const { id: _id, ...parsed } = entry;
        expectRoundTrip(envelope, parsed as IrisEnvelope, false);
      });
    }
  });

  describe("rabbit (native + x-iris headers)", () => {
    for (const [name, envelope] of Object.entries(cases)) {
      it(`round-trips: ${name}`, () => {
        const { properties, routingKey } = buildAmqpHeaders(envelope, envelope.headers);
        const msg = {
          content: envelope.payload,
          fields: { routingKey, exchange: "iris", deliveryTag: 1, redelivered: false },
          properties,
        } as unknown as ConsumeMessage;
        const parsed = buildRabbitEnvelope(parseAmqpHeaders(msg));
        expectRoundTrip(envelope, parsed, false);
      });
    }
  });
});
