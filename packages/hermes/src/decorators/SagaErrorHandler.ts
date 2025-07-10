import { Constructor } from "@lindorm/types";
import { DomainError } from "../errors";
import { SagaErrorHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function SagaErrorHandler<C extends Constructor<DomainError>>(
  ErrorClass: C,
): SagaErrorHandlerDescriptor<C> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: null,
      decorator: "SagaErrorHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: ErrorClass,
    });
  };
}
