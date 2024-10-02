import { ENCRYPTION_STORE } from "../../../constants/private";

export const CREATE_TABLE_ENCRYPTION_STORE = `
  CREATE TABLE IF NOT EXISTS ${ENCRYPTION_STORE} (
    id UUID NOT NULL,
    name VARCHAR ( 64 ) NOT NULL,
    context VARCHAR ( 32 ) NOT NULL,
    key_id UUID NOT NULL,
    key_algorithm VARCHAR ( 32 ) NOT NULL,
    key_curve VARCHAR ( 16 ),
    key_encryption VARCHAR ( 16 ) NOT NULL,
    key_type VARCHAR ( 4 ) NOT NULL,
    private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    PRIMARY KEY (
      id,
      name,
      context
    )
  )
`;
