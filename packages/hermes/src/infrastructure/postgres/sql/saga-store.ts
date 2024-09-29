import { SAGA_STORE } from "../../../constants/private";

export const CREATE_TABLE_SAGA_STORE = `
  CREATE TABLE IF NOT EXISTS ${SAGA_STORE} (
    id UUID NOT NULL,
    name VARCHAR ( 64 ) NOT NULL,
    context VARCHAR ( 32 ) NOT NULL,
    destroyed BOOLEAN NOT NULL,
    hash VARCHAR ( 16 ) NOT NULL,
    messages_to_dispatch JSONB NOT NULL,
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
