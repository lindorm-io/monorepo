import React, { FunctionComponent, ReactNode } from "react";
import { Box, Grid } from "@mui/material";

type Props = {
  children?: ReactNode;
};

export const AuthenticationPageWrapper: FunctionComponent<Props> = ({ children }) => (
  <Grid
    container
    component="main"
    sx={{ height: "100vh" }}
  >
    <Grid
      item
      md={5}
      sm={7}
      xs={12}
    >
      <Box
        alignItems="center"
        display="flex"
        flex={1}
        flexDirection="column"
        height="100vh"
        justifyContent="center"
        paddingX={2}
        paddingY={2}
        gap={2}
      >
        {children}
      </Box>
    </Grid>
    <Grid
      item
      md={7}
      sm={5}
      xs={false}
      sx={{
        backgroundImage: "url(pexels-dagmara-dombrovska-6739035.jpg)",
        backgroundRepeat: "no-repeat",
        backgroundColor: (t) =>
          t.palette.mode === "light" ? t.palette.grey[50] : t.palette.grey[900],
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  </Grid>
);
