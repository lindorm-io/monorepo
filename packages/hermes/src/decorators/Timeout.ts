import { Constructor } from "@lindorm/types";
import { TimeoutDecoratorOptions } from "../types";
import { extractNameData, globalHermesMetadata } from "../utils/private";

export function Timeout(options: TimeoutDecoratorOptions = {}): ClassDecorator {
  return function (target) {
    const { name, version } = extractNameData(target.name);
    globalHermesMetadata.addTimeout({
      name: options.name || name,
      target: target as unknown as Constructor,
      version: options.version ?? version,
    });
  };
}
