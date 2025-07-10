import { isArray } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { SagaDecoratorOptions } from "../types";
import { extractNameData, globalHermesMetadata } from "../utils/private";

export function Saga(
  AggregateClass: Constructor | Array<Constructor>,
  options: SagaDecoratorOptions = {},
): ClassDecorator {
  return function (target) {
    const { name } = extractNameData(target.name);
    globalHermesMetadata.addSaga({
      aggregates: isArray(AggregateClass) ? AggregateClass : [AggregateClass],
      name: options.name || name,
      namespace: options.namespace || null,
      target: target as unknown as Constructor,
    });
  };
}
