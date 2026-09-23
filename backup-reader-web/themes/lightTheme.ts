import { createTheme } from "@mui/material/styles";

export const lightheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#81d4fa",
    },
    secondary: {
      main: "#5400BF",
    },
  },
  typography: {
    fontFamily: ["PT Serif", "Open Sans"].join(","),
  },
});
