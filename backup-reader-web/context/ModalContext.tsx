import { Modal } from "@nextui-org/react";
import { createContext, useState } from "react";

export interface PropsDataState {
  visible?: boolean;
  isFullScreen?: boolean;
  withScroll?: boolean;
  withButtonClose?: boolean;
  modalContent: JSX.Element | null;
}

export interface ModalState {
  props: PropsDataState;
}

export const initialState: ModalState = {
  props: {
    visible: false,
    isFullScreen: false,
    withScroll: false,
    withButtonClose: false,
    modalContent: null,
  },
};

type ModalContextProps = {
  hide: () => void;
  state: ModalState;
  show: (props: PropsDataState) => void;
};

export const ModalContext = createContext({} as ModalContextProps);

export const ModalProvider = ({
  children,
}: {
  children: JSX.Element | JSX.Element[];
}) => {
  const [state, setState] = useState<ModalState>(initialState);

  const hide = () =>
    setState({
      props: { visible: false, modalContent: null, isFullScreen: false },
    });

  const show = ({
    modalContent,
    isFullScreen,
    withScroll,
    withButtonClose,
  }: PropsDataState): void => {
    setState({
      props: {
        visible: true,
        modalContent,
        isFullScreen,
        withScroll,
        withButtonClose,
      },
    });
  };

  return (
    <ModalContext.Provider value={{ state, hide, show }}>
      {children}
    </ModalContext.Provider>
  );
};

export const ModalConsumer: React.FC = () => {
  const render = (Component: JSX.Element | null) => {
    if (Component) return Component;
    return null;
  };
  return (
    <ModalContext.Consumer>
      {({
        state: {
          props: {
            visible,
            isFullScreen,
            withScroll,
            withButtonClose,
            modalContent,
          },
        },
      }) => (
        <Modal
          open={visible}
          closeButton={withButtonClose}
          blur
          aria-labelledby="modal-title"
          scroll={withScroll ? withScroll : false}
          fullScreen={isFullScreen ? isFullScreen : false}
        >
          {render(modalContent)}
        </Modal>
      )}
    </ModalContext.Consumer>
  );
};
