import React from "react";
import { InputAdornment, TextField } from "@mui/material";
import { PhoneIphone } from "@mui/icons-material";
import { TextFieldProps } from "@mui/material/TextField/TextField";

export const PhoneInputField = (props: TextFieldProps): JSX.Element => (
  <TextField
    InputProps={{
      endAdornment: (
        <InputAdornment position="end">
          <PhoneIphone color="primary" />
        </InputAdornment>
      ),
    }}
    autoComplete="phone"
    fullWidth
    label="phone"
    placeholder="+46701234567"
    type="tel"
    {...props}
  />
);
