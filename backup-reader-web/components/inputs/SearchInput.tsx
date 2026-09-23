import { FC, useState } from "react";
import { Input } from "@nextui-org/react";
import SearchIcon from "@mui/icons-material/Search";
import { IconButton } from "@mui/material";

type SearchInputProps = {
  width?: number;
  placeHolder: string;
  onSearch: (value: string) => void;
};

export const SearchInput: FC<SearchInputProps> = ({
  placeHolder,
  onSearch,
  width = 150,
}) => {
  const [value, setValue] = useState<string>("");
  return (
    <Input
      aria-label="search input"
      onChange={(e) => setValue(e.target.value)}
      clearable
      contentRightStyling={false}
      placeholder={placeHolder}
      contentRight={
        <IconButton
          size="small"
          style={{ marginRight: 5 }}
          onClick={() => onSearch(value)}
        >
          <SearchIcon style={{ color: "#0F52BA" }} />
        </IconButton>
      }
      style={{ width: width }}
    />
  );
};
