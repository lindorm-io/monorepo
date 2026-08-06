import type { ChangeCase, KeysInput, KeysOptions } from "../../types/index.js";
import {
  camelKeys,
  capitalKeys,
  constantKeys,
  dotKeys,
  headerKeys,
  kebabKeys,
  lowerKeys,
  pascalKeys,
  pathKeys,
  sentenceKeys,
  snakeKeys,
} from "../specific/index.js";

export const changeKeys = <T extends KeysInput = KeysInput>(
  input: T,
  mode: ChangeCase = "none",
  options?: KeysOptions,
): T => {
  switch (mode) {
    case "camel":
      return camelKeys(input, options);

    case "capital":
      return capitalKeys(input, options);

    case "constant":
      return constantKeys(input, options);

    case "dot":
      return dotKeys(input, options);

    case "header":
      return headerKeys(input, options);

    case "kebab":
      return kebabKeys(input, options);

    case "lower":
      return lowerKeys(input, options);

    case "pascal":
      return pascalKeys(input, options);

    case "path":
      return pathKeys(input, options);

    case "sentence":
      return sentenceKeys(input, options);

    case "snake":
      return snakeKeys(input, options);

    case "none":
      // Nothing is converted, so `options` (depth included) is never inspected.
      return input;

    default:
      throw new Error(`Invalid transform case [ ${mode as any} ]`);
  }
};
