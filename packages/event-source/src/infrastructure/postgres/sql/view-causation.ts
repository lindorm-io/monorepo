export const CREATE_TABLE_VIEW_CAUSATION = `
  CREATE TABLE IF NOT EXISTS view_causation (
    view_id VARCHAR ( 64 ) NOT NULL,
    view_name VARCHAR ( 64 ) NOT NULL,
    view_context VARCHAR ( 32 ) NOT NULL,
    causation_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    
    PRIMARY KEY (
      view_id,
      view_name,
      view_context,
      causation_id
    )
  )
`;

export const CREATE_INDEX_VIEW_CAUSATION_IDENTIFIER = `
  CREATE INDEX idx_view_causation_identifier
    ON view_causation (view_id, view_name, view_context);
`;
