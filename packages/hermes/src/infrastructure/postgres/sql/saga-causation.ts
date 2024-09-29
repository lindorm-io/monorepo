import { SAGA_CAUSATION } from "../../../constants/private";

export const CREATE_TABLE_SAGA_CAUSATION = `
  CREATE TABLE IF NOT EXISTS ${SAGA_CAUSATION} (
    id VARCHAR ( 64 ) NOT NULL,
    name VARCHAR ( 64 ) NOT NULL,
    context VARCHAR ( 32 ) NOT NULL,
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
