import React from "react";
import { AccountCircle } from "@mui/icons-material";
import { InputAdornment, TextField } from "@mui/material";
import { TextFieldProps } from "@mui/material/TextField/TextField";

export const UsernameInputField = (props: TextFieldProps): JSX.Element => (
  <TextField
    InputProps={{
      endAdornment: (
        <InputAdornment position="end">
          <AccountCircle color="primary" />
        </InputAdornment>
      ),
    }}
    autoComplete="username"
    fullWidth
    label="username"
    placeholder="email@address.com / user_name"
    {...props}
  />
);
