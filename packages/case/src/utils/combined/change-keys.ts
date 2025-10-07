import { ChangeCase, KeysInput } from "../../types";
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
} from "../specific";

export const changeKeys = <T extends KeysInput = KeysInput>(
  input: T,
  mode: ChangeCase = "none",
): T => {
  switch (mode) {
    case "camel":
      return camelKeys(input);

    case "capital":
      return capitalKeys(input);

    case "constant":
      return constantKeys(input);

    case "dot":
      return dotKeys(input);

    case "header":
      return headerKeys(input);

    case "kebab":
      return kebabKeys(input);

    case "lower":
      return lowerKeys(input);

    case "pascal":
      return pascalKeys(input);

    case "path":
      return pathKeys(input);

    case "sentence":
      return sentenceKeys(input);

    case "snake":
      return snakeKeys(input);

    case "none":
      return input;

    default:
      throw new Error(`Invalid transform case [ ${mode as any} ]`);
  }
};
