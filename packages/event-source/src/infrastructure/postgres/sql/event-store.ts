export const CREATE_TABLE_EVENT_STORE = `
  CREATE TABLE IF NOT EXISTS event_store (
    id UUID NOT NULL,
    name VARCHAR ( 64 ) NOT NULL,
    context VARCHAR ( 32 ) NOT NULL,
    causation_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    events JSONB NOT NULL,
    expected_events INT NOT NULL,
    previous_event_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    
    PRIMARY KEY (
      id,
      name,
      context,
      causation_id
    )
  )
`;

export const CREATE_INDEX_EVENT_STORE_IDENTIFIER = `
  CREATE INDEX idx_event_store_identifier
    ON event_store (id, name, context);
`;

export const CREATE_INDEX_EVENT_STORE_UNIQUE_EXPECTED_EVENTS = `
  CREATE UNIQUE INDEX idx_event_store_unique_expected_events
    ON event_store (id, name, context, expected_events);
`;

export const CREATE_INDEX_EVENT_STORE_UNIQUE_PREVIOUS_EVENT = `
  CREATE UNIQUE INDEX idx_event_store_unique_previous_event
    ON event_store (id, name, context, previous_event_id);
`;
