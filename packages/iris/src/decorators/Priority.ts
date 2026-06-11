import { IrisMetadataError } from "../errors/IrisMetadataError.js";
import { stagePriority } from "../internal/message/metadata/stage-metadata.js";

/**
 * Sets a default delivery priority (0-10 inclusive) for a message type.
 *
 * Priority is **broker-dependent and advisory**. It is only honored by drivers
 * that declare the `priority` capability — currently RabbitMQ, which declares
 * its consuming queues with `x-max-priority` so the broker delivers
 * higher-priority messages ahead of lower-priority ones already waiting in the
 * queue.
 *
 * The memory, Kafka, NATS, and Redis drivers have no native priority-queue
 * concept and treat this value as advisory metadata only: it is propagated on
 * the envelope / `x-iris-priority` header but does not reorder delivery. On
 * those drivers messages are delivered in publish order regardless of priority.
 */
export const Priority =
  (priority: number) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    if (!Number.isInteger(priority) || priority < 0 || priority > 10) {
      throw new IrisMetadataError("@Priority value must be an integer between 0 and 10", {
        code: "invalid_priority",
        title: "Invalid Priority",
        details:
          "The @Priority decorator requires an integer between 0 and 10 inclusive.",
      });
    }
    stagePriority(context.metadata, priority);
  };
