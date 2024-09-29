import { EVENT_STORE } from "../../../constants/private";

export const CREATE_TABLE_EVENT_STORE = `
  CREATE TABLE IF NOT EXISTS ${EVENT_STORE} (
    id UUID NOT NULL,
    name VARCHAR ( 64 ) NOT NULL,
    context VARCHAR ( 32 ) NOT NULL,
    causation_id UUID NOT NULL,
    checksum VARCHAR ( 64 ) NOT NULL,
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
    ),
    UNIQUE (
      id,
      name,
      context,
      expected_events
    ),
    UNIQUE (
      id,
      name,
      context,
      previous_event_id
    )
  )
`;
