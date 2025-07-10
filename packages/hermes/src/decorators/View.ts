/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { isArray } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { ViewDecoratorOptions, ViewStoreSource } from "../types";
import { extractNameData, globalHermesMetadata } from "../utils/private";

export function View(
  AggregateClass: Constructor | Array<Constructor>,
  source: ViewStoreSource,
  options: ViewDecoratorOptions = {},
): ClassDecorator {
  return function (target) {
    const { name } = extractNameData(target.name);
    globalHermesMetadata.addView({
      aggregates: isArray(AggregateClass) ? AggregateClass : [AggregateClass],
      name: options.name || name,
      namespace: options.namespace || null,
      source,
      target: target as unknown as Constructor,
    });
  };
}
