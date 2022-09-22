import { LockPersonOutlined } from "@mui/icons-material";
import { IconButton, Typography } from "@mui/material";
import React from "react";

export const AuthenticationPageHeader = (): JSX.Element => (
  <>
    <IconButton href="/api/authorize">
      <LockPersonOutlined
        color="primary"
        fontSize="large"
      />
    </IconButton>
    <Typography
      variant="h4"
      paddingBottom={2}
    >
      Sign in
    </Typography>
  </>
);
