/**
 * Maximum priority level for RabbitMQ priority queues.
 *
 * Consuming queues are declared with the `x-max-priority` argument so the
 * broker honors `properties.priority` (set from the message envelope by
 * build-amqp-headers). Messages with a higher priority value are delivered
 * before lower-priority messages already waiting in the queue.
 *
 * This matches the @Priority decorator range (0-10 inclusive). Declaring an
 * existing queue with a different `x-max-priority` raises PRECONDITION_FAILED,
 * so this value must remain stable for already-declared queues.
 */
export const RABBIT_MAX_PRIORITY = 10;
