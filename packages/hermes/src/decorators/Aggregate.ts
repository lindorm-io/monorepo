import { Constructor } from "@lindorm/types";
import { AggregateDecoratorOptions } from "../types";
import { extractNameData, globalHermesMetadata } from "../utils/private";

export function Aggregate(options: AggregateDecoratorOptions = {}): ClassDecorator {
  return function (target) {
    const { name } = extractNameData(target.name);
    globalHermesMetadata.addAggregate({
      encryption: options.encryption || false,
      name: options.name || name,
      namespace: options.namespace || null,
      target: target as unknown as Constructor,
    });
  };
}
