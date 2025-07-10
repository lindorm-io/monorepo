import { Constructor } from "@lindorm/types";
import { DomainError } from "../errors";
import { AggregateErrorHandlerDescriptor } from "../types";
import { globalHermesMetadata } from "../utils/private";

export function AggregateErrorHandler<C extends Constructor<DomainError>>(
  ErrorClass: C,
): AggregateErrorHandlerDescriptor<C> {
  return function (target, key, descriptor) {
    globalHermesMetadata.addHandler({
      conditions: null,
      decorator: "AggregateErrorHandler",
      encryption: false,
      handler: descriptor.value,
      key: key.toString(),
      schema: null,
      target: target.constructor as Constructor,
      trigger: ErrorClass,
    });
  };
}
