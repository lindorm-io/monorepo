import {
  EVENT_STORE,
  MAX_CONTEXT_LENGTH,
  MAX_NAME_LENGTH,
} from "../../../constants/private";

export const CREATE_TABLE_EVENT_STORE = `
  CREATE TABLE IF NOT EXISTS ${EVENT_STORE} (
    aggregate_id UUID NOT NULL,
    aggregate_name VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
    aggregate_context VARCHAR ( ${MAX_CONTEXT_LENGTH} ) NOT NULL,
    causation_id UUID NOT NULL,
    checksum VARCHAR ( 256 ) NOT NULL,
    correlation_id UUID NOT NULL,
    data JSONB NOT NULL,
    encrypted BOOLEAN NOT NULL,
    event_id UUID NOT NULL,
    event_name VARCHAR ( 256 ) NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    expected_events INT NOT NULL,
    meta JSONB NOT NULL,
    previous_event_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    version INT NOT NULL,

    PRIMARY KEY (
      aggregate_id,
      aggregate_name,
      aggregate_context,
      causation_id,
      event_id
    ),
    UNIQUE (
      aggregate_id,
      aggregate_name,
      aggregate_context,
      expected_events,
      event_id
    ),
    UNIQUE (
      aggregate_id,
      aggregate_name,
      aggregate_context,
      previous_event_id,
      event_id
    )
  )
`;
