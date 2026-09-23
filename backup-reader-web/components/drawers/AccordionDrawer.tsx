import React, { FC, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Theme,
  Typography,
  useMediaQuery,
} from "@mui/material";

const styles = {
  title: {
    letterSpacing: 0.5,
  },
};

type AccordionDrawerProps = {
  title: string;
  textContent: string;
};

export const AccordionDrawer: FC<AccordionDrawerProps> = ({
  title,
  textContent,
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );
  return (
    <Box>
      <Accordion
        expanded={open}
        onChange={() => setOpen(!open)}
        style={{
          backgroundColor: "#FFF",
          marginBottom: 20,
          boxShadow: "none",
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1bh-content"
          id="panel1bh-header"
        >
          <Typography
            fontFamily={"Open Sans"}
            variant={"subtitle1"}
            sx={{
              ...styles.title,
              width: phone ? "80%" : "50%",
              flexShrink: 0,
            }}
          >
            {title}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography
            variant={"caption"}
            fontSize={14}
            fontFamily={"Open Sans"}
            sx={styles.title}
          >
            {textContent}
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
