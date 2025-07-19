import { ChangeCase } from "../../types";
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

export const changeCase = (input: string, mode: ChangeCase = "none"): string => {
  switch (mode) {
    case "camel":
      return camelCase(input);

    case "capital":
      return capitalCase(input);

    case "constant":
      return constantCase(input);

    case "dot":
      return dotCase(input);

    case "header":
      return headerCase(input);

    case "kebab":
      return kebabCase(input);

    case "lower":
      return lowerCase(input);

    case "pascal":
      return pascalCase(input);

    case "path":
      return pathCase(input);

    case "sentence":
      return sentenceCase(input);

    case "snake":
      return snakeCase(input);

    case "none":
      return input;

    default:
      throw new Error(`Invalid transform case [ ${mode} ]`);
  }
};
