import { Constructor } from "@lindorm/types";
import { globalHermesMetadata } from "../utils/private";

export function Query(): ClassDecorator {
  return function (target) {
    globalHermesMetadata.addQuery({
      name: target.name,
      target: target as unknown as Constructor,
    });
  };
}
