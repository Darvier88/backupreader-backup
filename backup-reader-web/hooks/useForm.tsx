import { useState } from "react";

export const useForm = <T extends Object>(initState: T) => {
  const [state, setState] = useState(initState);

  const onChange = <B extends Object>(field: keyof T | string, value: B) => {
    setState({
      ...state,
      [field]: value,
    });
  };

  const onReset = () => {
    setState(initState);
  };

  return {
    ...state,
    formState: state,
    setFormState: onChange,
    onReset,
  };
};
