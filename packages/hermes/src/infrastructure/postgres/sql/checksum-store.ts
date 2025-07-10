import {
  CHECKSUM_STORE,
  MAX_NAMESPACE_LENGTH,
  MAX_NAME_LENGTH,
} from "../../../constants/private";

export const CREATE_TABLE_CHECKSUM_STORE = `
  CREATE TABLE IF NOT EXISTS ${CHECKSUM_STORE} (
    id UUID NOT NULL,
    name VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
    namespace VARCHAR ( ${MAX_NAMESPACE_LENGTH} ) NOT NULL,
    event_id UUID NOT NULL,
    checksum VARCHAR ( 256 ) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    PRIMARY KEY (
      id,
      name,
      namespace,
      event_id
    )
  )
`;
