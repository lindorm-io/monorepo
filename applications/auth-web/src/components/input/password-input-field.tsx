import React from "react";
import { Password } from "@mui/icons-material";
import { InputAdornment, TextField } from "@mui/material";
import { TextFieldProps } from "@mui/material/TextField/TextField";

export const PasswordInputField = (props: TextFieldProps): JSX.Element => (
  <TextField
    InputProps={{
      endAdornment: (
        <InputAdornment position="end">
          <Password color="primary" />
        </InputAdornment>
      ),
    }}
    autoComplete="current-password"
    fullWidth
    label="password"
    type="password"
    {...props}
  />
);
