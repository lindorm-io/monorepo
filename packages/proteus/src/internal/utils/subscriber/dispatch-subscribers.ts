import type { Constructor } from "@lindorm/types";
import type { IEntitySubscriber } from "../../../interfaces/EntitySubscriber";

/**
 * The set of subscriber event method names that can be dispatched.
 */
export type SubscriberEventName =
  | "beforeInsert"
  | "afterInsert"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDestroy"
  | "afterDestroy"
  | "beforeSoftDestroy"
  | "afterSoftDestroy"
  | "beforeRestore"
  | "afterRestore"
  | "afterLoad";

/**
 * Dispatch a subscriber lifecycle event to all matching subscribers.
 *
 * Matching rules:
 * - If a subscriber has no `listenTo` method, or it returns `undefined`,
 *   `null`, or an empty array, the subscriber matches ALL entity classes.
 * - Otherwise, the subscriber matches only if `listenTo()` includes the
 *   entity's constructor.
 *
 * Subscribers are called in registration order. Each call is awaited
 * sequentially so that side effects (e.g. audit logging) happen in a
 * predictable order. Errors propagate to the caller (no swallowing).
 */
export const dispatchSubscribers = async (
  eventName: SubscriberEventName,
  event: unknown,
  entityConstructor: Constructor,
  subscribers: ReadonlyArray<IEntitySubscriber>,
): Promise<void> => {
  for (const subscriber of subscribers) {
    if (!matchesEntity(subscriber, entityConstructor)) continue;

    const handler = subscriber[eventName] as
      | ((event: any) => void | Promise<void>)
      | undefined;
    if (!handler) continue;

    await handler.call(subscriber, event);
  }
};

const matchesEntity = (
  subscriber: IEntitySubscriber,
  entityConstructor: Constructor,
): boolean => {
  if (!subscriber.listenTo) return true;

  const targets = subscriber.listenTo();

  if (!targets || targets.length === 0) return true;

  return targets.includes(entityConstructor);
};
