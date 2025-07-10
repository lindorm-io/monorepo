import { Constructor, Dict } from "@lindorm/types";
import { SagaEventHandlerDecoratorOptions, SagaEventHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function SagaEventHandler<C extends Constructor, S extends Dict>(
  EventClass: C,
  options: SagaEventHandlerDecoratorOptions = {},
): SagaEventHandlerDescriptor<C, S> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: options.conditions || null,
      decorator: "SagaEventHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: EventClass,
    });
  };
}
