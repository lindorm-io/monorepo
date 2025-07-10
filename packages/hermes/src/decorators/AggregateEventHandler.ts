import { Constructor, Dict } from "@lindorm/types";
import { AggregateEventHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function AggregateEventHandler<C extends Constructor, S extends Dict>(
  EventClass: C,
): AggregateEventHandlerDescriptor<C, S> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: null,
      decorator: "AggregateEventHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: EventClass,
    });
  };
}
