import { Button, ButtonProps } from "@mui/material";
import React from "react";

export const TertiaryActionButton = ({ children, ...props }: ButtonProps): JSX.Element => (
  <Button
    color="secondary"
    fullWidth
    size="small"
    variant="outlined"
    {...props}
  >
    {children}
  </Button>
);
