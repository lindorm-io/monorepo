import {
  ENCRYPTION_STORE,
  MAX_CONTEXT_LENGTH,
  MAX_NAME_LENGTH,
} from "../../../constants/private";

export const CREATE_TABLE_ENCRYPTION_STORE = `
  CREATE TABLE IF NOT EXISTS ${ENCRYPTION_STORE} (
    id UUID NOT NULL,
    name VARCHAR ( ${MAX_NAME_LENGTH} ) NOT NULL,
    context VARCHAR ( ${MAX_CONTEXT_LENGTH} ) NOT NULL,
    key_id UUID NOT NULL,
    key_algorithm VARCHAR ( 32 ) NOT NULL,
    key_curve VARCHAR ( 16 ),
    key_encryption VARCHAR ( 16 ) NOT NULL,
    key_type VARCHAR ( 4 ) NOT NULL,
    private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    PRIMARY KEY (
      id,
      name,
      context
    )
  )
`;
