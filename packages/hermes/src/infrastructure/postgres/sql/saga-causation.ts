import {
  MAX_CONTEXT_LENGTH,
  MAX_NAME_LENGTH,
  SAGA_CAUSATION,
} from "../../../constants/private";

export const CREATE_TABLE_SAGA_CAUSATION = `
  CREATE TABLE IF NOT EXISTS ${SAGA_CAUSATION} (
    id VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
    name VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
    context VARCHAR ( ${MAX_CONTEXT_LENGTH} ) NOT NULL,
    causation_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    
    PRIMARY KEY (
      id,
      name,
      context,
      causation_id
    )
  )
`;
