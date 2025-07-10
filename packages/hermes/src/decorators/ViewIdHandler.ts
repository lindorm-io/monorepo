import { Constructor } from "@lindorm/types";
import { ViewIdHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function ViewIdHandler<C extends Constructor>(
  EventClass: C,
): ViewIdHandlerDescriptor<C> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: null,
      decorator: "ViewIdHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: EventClass,
    });
  };
}
