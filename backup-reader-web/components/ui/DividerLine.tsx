import { FC } from "react";

const styles = {
  dividerContainer: {
    display: "flex",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  dividerLine: {
    width: "100%",
    height: 1,
    backgroundColor: "grey",
  },
};

type DividerLineProps = {
  width?: number | string;
};
export const DividerLine: FC<DividerLineProps> = ({ width = 300 }) => {
  return (
    <>
      <div style={{ ...styles.dividerContainer, width: width }}>
        <div style={styles.dividerLine} />
      </div>
    </>
  );
};
