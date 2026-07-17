import type { IrisEnvelope } from "../types/iris-envelope.js";

/**
 * The scalar metadata fields of an {@link IrisEnvelope} — every field except the
 * three structural ones each transport carries in its own native slot:
 *   - `payload`  → the message body/value,
 *   - `headers`  → the user headers (JSON blob or transport header list),
 *   - `identifierValue` → Kafka's partition key (see {@link IdentifierField};
 *      never on the wire for nats/redis/rabbit).
 *
 * These 14 fields are the ones every driver used to re-enumerate by hand. They
 * are declared ONCE here; the transport adapters (`header-map`, `flat-hash`,
 * `json-body`) walk this table so a driver only declares its wire SHAPE, never
 * the field list. Adding or removing an envelope field is a one-line change in
 * this table.
 */
export type ScalarFieldKey =
  | "topic"
  | "attempt"
  | "maxRetries"
  | "retryStrategy"
  | "retryDelay"
  | "retryDelayMax"
  | "retryMultiplier"
  | "retryJitter"
  | "priority"
  | "timestamp"
  | "expiry"
  | "broadcast"
  | "replyTo"
  | "correlationId";

/** The subset of an envelope covered by the field table. */
export type ScalarFields = Pick<IrisEnvelope, ScalarFieldKey>;

/** A decoded scalar value in its typed (envelope-native) form. */
export type ScalarValue = string | number | boolean | null;

/**
 * How a scalar maps to and from a wire value. Drives both the string codec
 * (kafka headers, redis hash, rabbit headers — everything is a string) and the
 * JSON codec (nats — values keep their native JSON type).
 */
export type WireKind =
  | "string"
  | "int"
  | "float"
  | "bool"
  | "nullable-int"
  | "nullable-string";

export type EnvelopeFieldSpec = {
  key: ScalarFieldKey;
  /** The `x-iris-…` header name for the header-map (kafka) and rabbit adapters. */
  header: string;
  kind: WireKind;
  /** Typed default applied on decode when the wire value is absent. */
  default: ScalarValue;
};

/**
 * The canonical field table — the single source of truth for the envelope wire
 * format. Order is significant: `json-body` (nats) and `flat-hash` (redis)
 * serialize scalars in this order, so it is kept stable to preserve wire bytes.
 */
export const ENVELOPE_FIELD_TABLE: ReadonlyArray<EnvelopeFieldSpec> = [
  { key: "topic", header: "x-iris-topic", kind: "string", default: "" },
  { key: "attempt", header: "x-iris-attempt", kind: "int", default: 0 },
  { key: "maxRetries", header: "x-iris-max-retries", kind: "int", default: 0 },
  {
    key: "retryStrategy",
    header: "x-iris-retry-strategy",
    kind: "string",
    default: "constant",
  },
  { key: "retryDelay", header: "x-iris-retry-delay", kind: "int", default: 1000 },
  {
    key: "retryDelayMax",
    header: "x-iris-retry-delay-max",
    kind: "int",
    default: 30000,
  },
  {
    key: "retryMultiplier",
    header: "x-iris-retry-multiplier",
    kind: "float",
    default: 2,
  },
  { key: "retryJitter", header: "x-iris-retry-jitter", kind: "bool", default: false },
  { key: "priority", header: "x-iris-priority", kind: "int", default: 0 },
  { key: "timestamp", header: "x-iris-timestamp", kind: "int", default: 0 },
  { key: "expiry", header: "x-iris-expiry", kind: "nullable-int", default: null },
  { key: "broadcast", header: "x-iris-broadcast", kind: "bool", default: false },
  { key: "replyTo", header: "x-iris-reply-to", kind: "nullable-string", default: null },
  {
    key: "correlationId",
    header: "x-iris-correlation-id",
    kind: "nullable-string",
    default: null,
  },
];

export const SPEC_BY_KEY: Readonly<Record<ScalarFieldKey, EnvelopeFieldSpec>> =
  Object.fromEntries(ENVELOPE_FIELD_TABLE.map((spec) => [spec.key, spec])) as Record<
    ScalarFieldKey,
    EnvelopeFieldSpec
  >;

/**
 * Fields RabbitMQ carries in AMQP-native slots rather than `x-iris-*` headers:
 *   - `topic`     → the routing key,
 *   - `priority`  → `properties.priority` (drives broker-native priority queues),
 *   - `timestamp` → `properties.timestamp`.
 *
 * A genuine transport constraint: priority MUST live in the native property for
 * the broker to order by it, so it is not duplicated into a header. All other
 * scalars — including the full retry-policy set — travel as `x-iris-*` headers
 * so retry policy is producer-authoritative on rabbit, matching every other
 * driver (see M2).
 */
export const RABBIT_NATIVE_KEYS: ReadonlySet<ScalarFieldKey> = new Set([
  "topic",
  "priority",
  "timestamp",
]);

/** The scalar specs rabbit serializes as `x-iris-*` headers (all but native). */
export const RABBIT_HEADER_SPECS: ReadonlyArray<EnvelopeFieldSpec> =
  ENVELOPE_FIELD_TABLE.filter((spec) => !RABBIT_NATIVE_KEYS.has(spec.key));
