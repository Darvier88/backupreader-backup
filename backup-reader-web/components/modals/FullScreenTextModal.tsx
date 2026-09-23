import { useContext } from "react";
import { ModalContext } from "../../context";
import { Button, Modal, Text } from "@nextui-org/react";
import { Typography } from "@mui/material";

type fullScreenTextModalProps = {
  title: string;
  bodyText?: string;
  onClick: () => void;
};

export const FullScreenTextModal: React.FC<fullScreenTextModalProps> = ({
  title,
  bodyText,
  onClick,
}) => {
  const { hide } = useContext(ModalContext);
  return (
    <>
      <Modal.Header>
        <Typography fontFamily={"PT Serif"} fontSize={18}>
          {title}
        </Typography>
      </Modal.Header>
      <Modal.Body>
      <h1>Términos y Condiciones de Backup Reader LLC para BackupReader.com</h1>

        <p>Fecha de Última Actualización: 23 de Enero de 2024</p>

        <h2>1. Aceptación de los Términos</h2>
        <p>Al acceder y utilizar BackupReader.com, propiedad de Backup Reader LLC, usted acuerda estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguno de los términos y condiciones aquí presentados, por favor no utilice ni acceda a este sitio web.</p>

        <h2>2. Recopilación y Uso de Información</h2>
        <p><strong>Google Analytics:</strong> Utilizamos Google Analytics para recopilar información sobre el comportamiento de los visitantes en nuestro sitio. Esta información nos ayuda a mejorar la experiencia del usuario. Google Analytics recopila información anónima que no lo identifica personalmente.</p>
        <p><strong>Información Subida por el Usuario:</strong> Almacenamos la información que los usuarios suben voluntariamente a BackupReader.com. Esto puede incluir, pero no está limitado a, datos personales, fotografías, y otros contenidos.</p>
        <p><strong>Acceso del Personal Técnico:</strong> Nuestro personal técnico puede tener acceso a su información para el mantenimiento y mejora del sitio. Este acceso está regulado y se realiza bajo estrictas medidas de seguridad.</p>

        <h2>3. Eliminación de Información y Cuenta</h2>
        <p>Usted puede solicitar la eliminación de su cuenta y toda la información asociada enviando un correo electrónico a info@backupreader.com. Tras recibir su solicitud, procederemos a eliminar su información de nuestros registros de manera oportuna.</p>

        <h2>4. Seguridad</h2>
        <p>Nos comprometemos a proteger la seguridad de su información. Implementamos medidas técnicas y organizativas adecuadas para proteger sus datos contra el acceso no autorizado, la alteración, la divulgación o la destrucción. Sin embargo, es importante destacar que, mientras tomamos todas las precauciones posibles, no podemos garantizar que nuestros servidores estén completamente exentos de hackeos o interrupciones del servicio. Reconocemos que ninguna medida de seguridad es infalible, y por tanto, no podemos asegurar una protección absoluta de la información.</p>

        <h2>5. Cambios en los Términos y Condiciones</h2>
        <p>Backup Reader LLC se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación en el sitio web. Es responsabilidad del usuario revisar regularmente esta sección para estar informado de cualquier cambio.</p>

        <h2>6. Contacto</h2>
        <p>Si tiene preguntas o comentarios sobre estos Términos y Condiciones, por favor contáctenos en info@backupreader.com.</p>

        <h2>7. Ley Aplicable y Jurisdicción</h2>
        <p>Estos Términos y Condiciones se regirán e interpretarán de acuerdo con las leyes del Estado de Florida, Estados Unidos, sin dar efecto a ningún principio de conflictos de ley. Cualquier disputa relacionada con estos términos será sometida a la jurisdicción exclusiva de los tribunales de ese estado.</p>

        <h2>8. Política de Privacidad</h2>
        <p>Por favor, consulte nuestra Política de Privacidad para entender cómo recopilamos, usamos y protegemos su información personal.</p>

        <h2>9. Derechos de Autor y Propiedad Intelectual</h2>
        <p>Todo el contenido publicado en BackupReader.com, incluyendo textos, gráficos, logos, y software, es propiedad de Backup Reader LLC o se utiliza

        con permiso. Los usuarios deben respetar los derechos de autor y propiedad intelectual al utilizar el sitio.</p>

        <h2>10. Limitación de Responsabilidad</h2>
        <p>Backup Reader LLC no será responsable por daños directos, indirectos, incidentales, especiales o consecuentes que resulten del uso o la incapacidad de uso de nuestro servicio.</p>

        <h2>11. Uso de Servicios de Terceros</h2>
        <p><strong>Stripe:</strong> Para procesar pagos, utilizamos Stripe. Al realizar pagos a través de nuestro sitio, usted acepta los términos de servicio de Stripe y reconoce que Backup Reader LLC no es responsable de las operaciones y seguridad de Stripe.</p>
        <p><strong>Olark:</strong> Utilizamos Olark para proporcionar soporte en vivo y chat. Al interactuar con nuestro soporte a través de Olark, usted está sujeto a los términos y políticas de privacidad de Olark.</p>
        <p><strong>YouTube:</strong> Nuestro sitio puede incluir contenido integrado de YouTube. Al visualizar estos contenidos, usted acepta estar sujeto a los términos de servicio de YouTube.</p>

        <p><strong>Backup Reader LLC</strong></p>

      </Modal.Body>
      <Modal.Footer>
        <Button flat auto color="error" onPress={hide}>
          Cerrar
        </Button>
        <Button onPress={onClick}> Aceptar</Button>
      </Modal.Footer>
    </>
  );
};
