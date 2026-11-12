import { Modal } from "@nextui-org/react";
import { createContext, useState } from "react";

export interface PropsDataState {
  visible?: boolean;
  /**
   * Ancho del diálogo. Por defecto NextUI usa uno estrecho, que en un aviso
   * importante queda como una notita en medio de la pantalla en vez de algo
   * que exija atención. Se puede subir por modal.
   */
  width?: string;
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
    width,
  }: PropsDataState): void => {
    setState({
      props: {
        visible: true,
        modalContent,
        isFullScreen,
        withScroll,
        withButtonClose,
        width,
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
            width,
          },
        },
      }) => (
        <Modal
          open={visible}
          closeButton={withButtonClose}
          blur
          /* Ancho cómodo por defecto, y nunca más que la pantalla: el mínimo
             con 92vw es lo que evita que en un móvil se salga por los lados. */
          width={width ?? "min(560px, 92vw)"}
          aria-labelledby="modal-title"
          scroll={withScroll ? withScroll : false}
          fullScreen={isFullScreen ? isFullScreen : false}
          /* La misma tarjeta que «Subiendo chat»: fondo papel y borde fino,
             no el blanco de NextUI. */
          css={isFullScreen ? undefined : { backgroundColor: "var(--paper-50)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card, 0 8px 30px rgba(22,35,59,0.12))" }}
        >
          {render(modalContent)}
        </Modal>
      )}
    </ModalContext.Consumer>
  );
};
