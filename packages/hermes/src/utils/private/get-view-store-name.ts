import { snakeCase } from "@lindorm/case";
import { HandlerIdentifier } from "../../types";

export const getViewStoreName = (view: HandlerIdentifier): string =>
  `v_${snakeCase(view.namespace)}_${snakeCase(view.name)}`;
