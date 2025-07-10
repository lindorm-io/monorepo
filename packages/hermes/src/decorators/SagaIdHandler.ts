import { Constructor } from "@lindorm/types";
import { SagaIdHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function SagaIdHandler<C extends Constructor>(
  EventClass: C,
): SagaIdHandlerDescriptor<C> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: null,
      decorator: "SagaIdHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: EventClass,
    });
  };
}
