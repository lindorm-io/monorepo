import { CHECKSUM_STORE } from "../../../constants/private";

export const CREATE_TABLE_CHECKSUM_STORE = `
  CREATE TABLE IF NOT EXISTS ${CHECKSUM_STORE} (
    id UUID NOT NULL,
    name VARCHAR ( 64 ) NOT NULL,
    context VARCHAR ( 32 ) NOT NULL,
    event_id UUID NOT NULL,
    checksum VARCHAR ( 64 ) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    PRIMARY KEY (
      id,
      name,
      context,
      event_id
    )
  )
`;
