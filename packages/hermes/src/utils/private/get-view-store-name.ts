import { snakeCase } from "@lindorm/case";
import { HandlerIdentifier } from "../../types";

export const getViewStoreName = (view: HandlerIdentifier): string =>
  `view_store_${snakeCase(view.context)}_${snakeCase(view.name)}`;
