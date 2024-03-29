import { HandlerIdentifier } from "../types";
import { snakeCase } from "@lindorm-io/case";

export const getViewStoreName = (view: HandlerIdentifier): string =>
  `view_store_${snakeCase(view.context)}_${snakeCase(view.name)}`;
