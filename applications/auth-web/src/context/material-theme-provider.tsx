import { ThemeProvider, createTheme } from "@mui/material";
import { amber, red } from "@mui/material/colors";
import { DefaultFC } from "../types/default-fc";

export const theme = createTheme({
  palette: {
    primary: red,
    secondary: amber,
  },
});

export const MaterialThemeProvider: DefaultFC = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);
