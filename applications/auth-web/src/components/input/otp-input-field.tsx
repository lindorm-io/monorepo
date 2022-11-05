import { ReactElement } from "react";
import { MuiOtpInput, MuiOtpInputProps } from "mui-one-time-password-input";

export const OtpInputField = (props: MuiOtpInputProps): ReactElement => <MuiOtpInput {...props} />;

// import React, { ReactElement } from "react";
// import { InputAdornment, TextField } from "@mui/material";
// import { Pin } from "@mui/icons-material";
// import { TextFieldProps } from "@mui/material/TextField/TextField";
//
// export const OtpInputField = (props: TextFieldProps): ReactElement => (
//   <TextField
//     InputProps={{
//       endAdornment: (
//         <InputAdornment position="end">
//           <Pin color="primary" />
//         </InputAdornment>
//       ),
//     }}
//     autoComplete="one-time-code"
//     fullWidth
//     inputMode="numeric"
//     label="one time password"
//     type="text"
//     {...props}
//   />
// );
