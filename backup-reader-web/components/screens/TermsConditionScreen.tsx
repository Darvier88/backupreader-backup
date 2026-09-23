import { FC } from "react";
import { useTranslation } from "react-i18next";

export const TermsConditionScreen: FC = () => {
  const { t } = useTranslation();
  return (
    <div className="br-root">
      <div className="br-prose">
        <h1>{t("Términos y Condiciones de Backup Reader LLC para BackupReader.com")}</h1>
        <p>{t("Fecha de Última Actualización: 23 de Enero de 2024")}</p>
        <h2>{t("1. Aceptación de los Términos")}</h2>
        <p>{t("Al acceder y utilizar BackupReader.com, propiedad de Backup Reader LLC, usted acuerda estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguno de los términos y condiciones aquí presentados, por favor no utilice ni acceda a este sitio web.")}</p>
        <h2>{t("2. Recopilación y Uso de Información")}</h2>
        <p><strong>{t("Google Analytics:")}</strong> {t("Utilizamos Google Analytics para recopilar información sobre el comportamiento de los visitantes en nuestro sitio. Esta información nos ayuda a mejorar la experiencia del usuario. Google Analytics recopila información anónima que no lo identifica personalmente.")}</p>
        <p><strong>{t("Información Subida por el Usuario:")}</strong> {t("Almacenamos la información que los usuarios suben voluntariamente a BackupReader.com. Esto puede incluir, pero no está limitado a, datos personales, fotografías, y otros contenidos.")}</p>
        <p><strong>{t("Acceso del Personal Técnico:")}</strong> {t("Nuestro personal técnico puede tener acceso a su información para el mantenimiento y mejora del sitio. Este acceso está regulado y se realiza bajo estrictas medidas de seguridad.")}</p>
        <h2>{t("3. Eliminación de Información y Cuenta")}</h2>
        <p>{t("Usted puede solicitar la eliminación de su cuenta y toda la información asociada enviando un correo electrónico a info@backupreader.com. Tras recibir su solicitud, procederemos a eliminar su información de nuestros registros de manera oportuna.")}</p>
        <h2>{t("4. Seguridad")}</h2>
        <p>{t("Nos comprometemos a proteger la seguridad de su información. Implementamos medidas técnicas y organizativas adecuadas para proteger sus datos contra el acceso no autorizado, la alteración, la divulgación o la destrucción. Sin embargo, es importante destacar que, mientras tomamos todas las precauciones posibles, no podemos garantizar que nuestros servidores estén completamente exentos de hackeos o interrupciones del servicio. Reconocemos que ninguna medida de seguridad es infalible, y por tanto, no podemos asegurar una protección absoluta de la información.")}</p>
        <h2>{t("5. Cambios en los Términos y Condiciones")}</h2>
        <p>{t("Backup Reader LLC se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación en el sitio web. Es responsabilidad del usuario revisar regularmente esta sección para estar informado de cualquier cambio.")}</p>
        <h2>{t("6. Contacto")}</h2>
        <p>{t("Si tiene preguntas o comentarios sobre estos Términos y Condiciones, por favor contáctenos en info@backupreader.com.")}</p>
        <h2>{t("7. Ley Aplicable y Jurisdicción")}</h2>
        <p>{t("Estos Términos y Condiciones se regirán e interpretarán de acuerdo con las leyes del Estado de Florida, Estados Unidos, sin dar efecto a ningún principio de conflictos de ley. Cualquier disputa relacionada con estos términos será sometida a la jurisdicción exclusiva de los tribunales de ese estado.")}</p>
        <h2>{t("8. Política de Privacidad")}</h2>
        <p>{t("Por favor, consulte nuestra Política de Privacidad para entender cómo recopilamos, usamos y protegemos su información personal.")}</p>
        <h2>{t("9. Derechos de Autor y Propiedad Intelectual")}</h2>
        <p>{t("Todo el contenido publicado en BackupReader.com, incluyendo textos, gráficos, logos, y software, es propiedad de Backup Reader LLC o se utiliza con permiso. Los usuarios deben respetar los derechos de autor y propiedad intelectual al utilizar el sitio.")}</p>
        <h2>{t("10. Limitación de Responsabilidad")}</h2>
        <p>{t("Backup Reader LLC no será responsable por daños directos, indirectos, incidentales, especiales o consecuentes que resulten del uso o la incapacidad de uso de nuestro servicio.")}</p>
        <h2>{t("11. Uso de Servicios de Terceros")}</h2>
        <p><strong>{t("Stripe:")}</strong> {t("Para procesar pagos, utilizamos Stripe. Al realizar pagos a través de nuestro sitio, usted acepta los términos de servicio de Stripe y reconoce que Backup Reader LLC no es responsable de las operaciones y seguridad de Stripe.")}</p>
        <p><strong>{t("Olark:")}</strong> {t("Utilizamos Olark para proporcionar soporte en vivo y chat. Al interactuar con nuestro soporte a través de Olark, usted está sujeto a los términos y políticas de privacidad de Olark.")}</p>
        <p><strong>{t("YouTube:")}</strong> {t("Nuestro sitio puede incluir contenido integrado de YouTube. Al visualizar estos contenidos, usted acepta estar sujeto a los términos de servicio de YouTube.")}</p>
        <p><strong>{t("Backup Reader LLC")}</strong></p>
      </div>
    </div>
  );
};
