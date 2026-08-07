import { isFunction } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import { stageTopic } from "../internal/message/metadata/stage-metadata.js";

/**
 * Sets the routing topic. Pass a CONSTANT string when the topic never varies —
 * that is the form `consume()` can resolve statically, so publisher and
 * consumer land on the same topic without agreeing on a queue string. Pass a
 * callback only when the topic genuinely depends on the message instance.
 *
 * A `@Namespace` is prefixed onto either form.
 */
export const Topic =
  <T extends Constructor>(topic: string | ((message: any) => string)) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageTopic(
      context.metadata,
      isFunction(topic)
        ? { type: "dynamic", callback: topic }
        : { type: "static", topic },
    );
  };
