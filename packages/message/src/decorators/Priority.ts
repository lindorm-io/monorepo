import { globalMessageMetadata } from "../utils";

export function Priority(priority: number): ClassDecorator {
  return function (target) {
    globalMessageMetadata.addPriority({
      target,
      priority,
    });
  };
}
