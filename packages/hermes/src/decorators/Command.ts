import { Constructor } from "@lindorm/types";
import { CommandDecoratorOptions } from "../types";
import { extractNameData, globalHermesMetadata } from "../utils/private";

export function Command(options: CommandDecoratorOptions = {}): ClassDecorator {
  return function (target) {
    const { name, version } = extractNameData(target.name);
    globalHermesMetadata.addCommand({
      aggregate: {
        name: options.aggregate?.name || null,
        namespace: options.aggregate?.namespace || null,
      },
      name: options.name || name,
      target: target as unknown as Constructor,
      version: options.version ?? version,
    });
  };
}
