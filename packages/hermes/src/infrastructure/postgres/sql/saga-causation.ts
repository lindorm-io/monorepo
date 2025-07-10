import {
  MAX_NAMESPACE_LENGTH,
  MAX_NAME_LENGTH,
  SAGA_CAUSATION,
} from "../../../constants/private";

export const CREATE_TABLE_SAGA_CAUSATION = `
  CREATE TABLE IF NOT EXISTS ${SAGA_CAUSATION} (
    id VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
    name VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
    namespace VARCHAR ( ${MAX_NAMESPACE_LENGTH} ) NOT NULL,
    causation_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    
    PRIMARY KEY (
      id,
      name,
      namespace,
      causation_id
    )
  )
`;
