import { ChangeCase } from "../../enums";
import {
  camelCase,
  capitalCase,
  constantCase,
  dotCase,
  headerCase,
  kebabCase,
  lowerCase,
  pascalCase,
  pathCase,
  sentenceCase,
  snakeCase,
} from "../specific";

export const changeCase = (input: string, mode: ChangeCase = ChangeCase.None): string => {
  switch (mode) {
    case ChangeCase.Camel:
      return camelCase(input);

    case ChangeCase.Capital:
      return capitalCase(input);

    case ChangeCase.Constant:
      return constantCase(input);

    case ChangeCase.Dot:
      return dotCase(input);

    case ChangeCase.Header:
      return headerCase(input);

    case ChangeCase.Kebab:
      return kebabCase(input);

    case ChangeCase.Lower:
      return lowerCase(input);

    case ChangeCase.Pascal:
      return pascalCase(input);

    case ChangeCase.Path:
      return pathCase(input);

    case ChangeCase.Sentence:
      return sentenceCase(input);

    case ChangeCase.Snake:
      return snakeCase(input);

    case ChangeCase.None:
      return input;

    default:
      throw new Error(`Invalid transform case [ ${mode} ]`);
  }
};
