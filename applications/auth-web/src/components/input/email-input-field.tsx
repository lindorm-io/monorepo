import React, { ReactElement } from "react";
import { Email } from "@mui/icons-material";
import { InputAdornment, TextField } from "@mui/material";
import { TextFieldProps } from "@mui/material/TextField/TextField";

export const EmailInputField = (props: TextFieldProps): ReactElement => (
  <TextField
    InputProps={{
      endAdornment: (
        <InputAdornment position="end">
          <Email color="primary" />
        </InputAdornment>
      ),
    }}
    autoComplete="email"
    fullWidth
    label="email address"
    placeholder="email@address.com"
    type="email"
    {...props}
  />
);
