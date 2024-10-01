import { EVENT_STORE } from "../../../constants/private";

export const CREATE_TABLE_EVENT_STORE = `
  CREATE TABLE IF NOT EXISTS ${EVENT_STORE} (
    aggregate_id UUID NOT NULL,
    aggregate_name VARCHAR ( 64 ) NOT NULL,
    aggregate_context VARCHAR ( 32 ) NOT NULL,
    causation_id UUID NOT NULL,
    checksum VARCHAR ( 64 ) NOT NULL,
    correlation_id UUID NOT NULL,
    data JSONB NOT NULL,
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
