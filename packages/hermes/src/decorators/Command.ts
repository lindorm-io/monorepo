import { Constructor } from "@lindorm/types";
import { CommandDecoratorOptions } from "../types";
import { extractNameData, globalHermesMetadata } from "../utils/private";

export function Command(options?: CommandDecoratorOptions): ClassDecorator {
  return function (target) {
    const { name } = extractNameData(target.name);
    globalHermesMetadata.addCommand({
      name: options?.name || name,
      target: target as unknown as Constructor,
    });
  };
}
