import { stageField } from "../internal/message/metadata/stage-metadata.js";

/**
 * Marks the primary identifier field.
 *
 * **Ordering is Kafka-only.** The identifier value is used solely as Kafka's
 * partition key — messages that share it land on the same partition and are
 * delivered in order. It is NOT portable: nats, redis, rabbit and memory carry
 * no such value on the wire and give no per-identifier ordering. Do not rely on
 * `@IdentifierField` for ordering on any driver other than Kafka.
 */
export const IdentifierField =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "IdentifierField",
      default: null,
      enum: null,
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      sensitive: null,
      transform: null,
      type: "string",
    });
  };
