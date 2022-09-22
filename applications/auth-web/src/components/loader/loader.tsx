import { FunctionComponent, ReactElement } from "react";
import { Box, CircularProgress } from "@mui/material";

export const Loader: FunctionComponent = () => (
  <Box
    display="flex"
    flex={1}
    alignItems="center"
    justifyContent="center"
  >
    <CircularProgress />
  </Box>
);
