import { Constructor } from "@lindorm/types";
import { DomainError } from "../errors";
import { ViewErrorHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function ViewErrorHandler<C extends Constructor<DomainError>>(
  ErrorClass: C,
): ViewErrorHandlerDescriptor<C> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: null,
      decorator: "ViewErrorHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: ErrorClass,
    });
  };
}
