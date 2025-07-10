import { Constructor, Dict } from "@lindorm/types";
import { ViewQueryHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function ViewQueryHandler<C extends Constructor, S extends Dict>(
  QueryClass: C,
): ViewQueryHandlerDescriptor<C, S> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: null,
      decorator: "ViewQueryHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: QueryClass,
    });
  };
}
