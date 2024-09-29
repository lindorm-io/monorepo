import { QueryConfig } from "pg";
import { HandlerIdentifier } from "../../../types";
import { getViewStoreName } from "../../../utils/private";

export const createViewStoreTable = (view: HandlerIdentifier): QueryConfig => {
  const text = `
    CREATE TABLE IF NOT EXISTS ${getViewStoreName(view)} (
      id UUID NOT NULL,
      name VARCHAR ( 64 ) NOT NULL,
      context VARCHAR ( 32 ) NOT NULL,
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
