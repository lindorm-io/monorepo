import React from "react";
import { LoadingButton, LoadingButtonProps } from "@mui/lab";

export const SecondaryActionButton = ({ children, ...props }: LoadingButtonProps): JSX.Element => (
  <LoadingButton
    fullWidth
    size="medium"
    variant="outlined"
    {...props}
  >
    {children}
  </LoadingButton>
);
