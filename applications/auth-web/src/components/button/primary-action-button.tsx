import { LoadingButton } from "@mui/lab";
import React from "react";
import { LoadingButtonProps } from "@mui/lab/LoadingButton/LoadingButton";

export const PrimaryActionButton = ({ children, ...props }: LoadingButtonProps): JSX.Element => (
  <LoadingButton
    color="primary"
    fullWidth
    size="large"
    variant="contained"
    {...props}
  >
    {children}
  </LoadingButton>
);
