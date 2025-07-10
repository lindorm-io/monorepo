import { Constructor } from "@lindorm/types";
import { EventDecoratorOptions } from "../types";
import { extractNameData, globalHermesMetadata } from "../utils/private";

export function Event(options?: EventDecoratorOptions): ClassDecorator {
  return function (target) {
    const { name, version } = extractNameData(target.name);
    globalHermesMetadata.addEvent({
      name: options?.name || name,
      target: target as unknown as Constructor,
      version: options?.version || version,
    });
  };
}
