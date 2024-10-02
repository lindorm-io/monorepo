import { QueryConfig } from "pg";
import { MAX_CONTEXT_LENGTH, MAX_NAME_LENGTH } from "../../../constants/private";
import { HandlerIdentifier } from "../../../types";
import { getViewStoreName } from "../../../utils/private";

export const createViewStoreTable = (view: HandlerIdentifier): QueryConfig => {
  const text = `
    CREATE TABLE IF NOT EXISTS ${getViewStoreName(view)} (
      id VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
      name VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
      context VARCHAR ( ${MAX_CONTEXT_LENGTH} ) NOT NULL,
      destroyed BOOLEAN NOT NULL,
      hash VARCHAR ( 16 ) NOT NULL,
      meta JSONB NOT NULL,
      processed_causation_ids JSONB NOT NULL,
      revision INTEGER NOT NULL,
      state JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      
      PRIMARY KEY (
        id,
        name,
        context
      )
    )
  `;
  return { text };
};
