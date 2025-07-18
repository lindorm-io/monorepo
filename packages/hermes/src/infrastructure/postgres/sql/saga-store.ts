import {
  MAX_NAMESPACE_LENGTH,
  MAX_NAME_LENGTH,
  SAGA_STORE,
} from "../../../constants/private";

export const CREATE_TABLE_SAGA_STORE = `
  CREATE TABLE IF NOT EXISTS ${SAGA_STORE} (
    id VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
    name VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
    namespace VARCHAR ( ${MAX_NAMESPACE_LENGTH} ) NOT NULL,
    destroyed BOOLEAN NOT NULL,
    messages_to_dispatch JSONB NOT NULL,
    processed_causation_ids JSONB NOT NULL,
    revision INTEGER NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    
    PRIMARY KEY (
      id,
      name,
      namespace
    )
  )
`;
