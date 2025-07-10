import { Constructor, Dict } from "@lindorm/types";
import { SagaTimeoutHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function SagaTimeoutHandler<C extends Constructor, S extends Dict>(
  TimeoutClass: C,
): SagaTimeoutHandlerDescriptor<C, S> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: null,
      decorator: "SagaTimeoutHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: TimeoutClass,
    });
  };
}
