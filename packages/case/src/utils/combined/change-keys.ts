import { ChangeCase } from "../../enums";
import { KeysInput } from "../../types";
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
  mode: ChangeCase = ChangeCase.None,
): T => {
  switch (mode) {
    case ChangeCase.Camel:
      return camelKeys(input);

    case ChangeCase.Capital:
      return capitalKeys(input);

    case ChangeCase.Constant:
      return constantKeys(input);

    case ChangeCase.Dot:
      return dotKeys(input);

    case ChangeCase.Header:
      return headerKeys(input);

    case ChangeCase.Kebab:
      return kebabKeys(input);

    case ChangeCase.Lower:
      return lowerKeys(input);

    case ChangeCase.Pascal:
      return pascalKeys(input);

    case ChangeCase.Path:
      return pathKeys(input);

    case ChangeCase.Sentence:
      return sentenceKeys(input);

    case ChangeCase.Snake:
      return snakeKeys(input);

    case ChangeCase.None:
      return input;

    default:
      throw new Error(`Invalid transform case [ ${mode} ]`);
  }
};
