type RowProps = {
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

export const Row: React.FC<RowProps> = ({
  children,
  alignItems = "stretch",
  justifyContent = "flex-start",
}) => (
  <div
    style={{
      alignItems: alignItems,
      justifyContent: justifyContent,
      flexDirection: "row",
    }}
  >
    {children}
  </div>
);
