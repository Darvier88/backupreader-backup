import { Input } from "@nextui-org/react";

interface AuthInputProps {
  placeHolder: string;
  isPassword?: boolean;
  onChange: (value: string) => void;
}

const styles = {
  authInputContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  authInputStyles: {
    color: "grey",
    borderColor: "grey",
    borderWidth: 1,
  },
};

export const AuthInput: React.FC<AuthInputProps> = ({
  placeHolder,
  onChange,
  isPassword = false,
}) => {
  return (
    <div style={styles.authInputContainer}>
      {isPassword ? (
        <Input.Password
          aria-label="password input"
          style={{ ...styles.authInputStyles, width: 240 }}
          bordered
          placeholder={placeHolder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          aria-label="standar input"
          clearable
          style={{ ...styles.authInputStyles, width: 280 }}
          bordered
          placeholder={placeHolder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};
