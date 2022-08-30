export const CREATE_TABLE_SAGA_CAUSATION = `
  CREATE TABLE IF NOT EXISTS saga_causation (
    saga_id VARCHAR ( 64 ) NOT NULL,
    saga_name VARCHAR ( 64 ) NOT NULL,
    saga_context VARCHAR ( 32 ) NOT NULL,
    causation_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    
    PRIMARY KEY (
      saga_id,
      saga_name,
      saga_context,
      causation_id
    )
  )
`;

export const CREATE_INDEX_SAGA_CAUSATION_IDENTIFIER = `
  CREATE INDEX idx_saga_causation_identifier
    ON saga_causation (saga_id, saga_name, saga_context);
`;
