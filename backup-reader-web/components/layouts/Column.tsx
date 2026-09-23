type ColumnProps = {
  children: JSX.Element | JSX.Element[];
  justifyContent?:
    | "center"
    | "flex-start"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly"
    | undefined;
  alignItems?:
    | "stretch"
    | "flex-start"
    | "flex-end"
    | "center"
    | "baseline"
    | undefined;
};

export const Column: React.FC<ColumnProps> = ({
  children,
  alignItems = "stretch",
  justifyContent = "flex-start",
}) => (
  <div
    style={{
      alignItems: alignItems,
      justifyContent: justifyContent,
      flexDirection: "column",
    }}
  >
    {children}
  </div>
);
