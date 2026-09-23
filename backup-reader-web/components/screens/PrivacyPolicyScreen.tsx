import { Typography, Button } from "@mui/material";
import { Grid } from "@nextui-org/react";
import { FC } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import Link from 'next/link';


export const PrivacyPolicyScreen: FC = () => {

  const router = useRouter();
  const { t } = useTranslation();

  const styles = {
    container1: {
      width: "80%",
      margin: "0 auto",
    },
    container2: {
      height: 100,
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
    }
  };

  return (
    <div className="br-root">

      <div className="br-prose">
        
        <h1>{t("Política de Privacidad de Backup Reader LLC para BackupReader.com")}</h1>
        <p>{t("Fecha de Última Actualización: 27 de Junio de 2024")}</p>

        <h2>1. {t("Información que Recopilamos")}</h2>
        <p>{t("Recopilamos información que los usuarios suben voluntariamente a nuestro sitio, incluyendo datos personales y contenidos. Además, utilizamos Google Analytics para recopilar datos anónimos sobre el comportamiento de los visitantes en nuestro sitio. Recopilamos información que los usuarios suben voluntariamente a nuestro sitio, incluyendo datos personales y contenidos. Además, utilizamos Google Analytics para recopilar datos anónimos sobre el comportamiento de los visitantes en nuestro sitio. También recopilamos datos de Google Drive como parte de nuestro servicio de respaldo de redes sociales, que incluye los archivos que los usuarios seleccionan y nos otorgan permiso para acceder, como fotos, videos y documentos.")}</p>

        <h2>2. {t("Uso de la Información")}</h2>
        <p>{t("La información recopilada se utiliza para mejorar la experiencia del usuario en nuestro sitio, mantener y mejorar nuestros servicios, y para propósitos de comunicación interna. Específicamente, utilizamos los datos recopilados de Google Drive para cargar, almacenar y procesar archivos de respaldo de redes sociales para presentar los datos en un formato fácilmente legible dentro de la aplicación Backup Reader.")}</p>

        <h2>3. {t("Compartir y Divulgar Información")}</h2>
        <p>{t("No compartimos los datos de los usuarios de Google con terceros, excepto cuando sea necesario para proporcionar nuestros servicios, cumplir con la ley o proteger nuestros derechos.")}</p>

        <h2>4. {t("Servicios de Terceros")}</h2>
        <p>{t("Utilizamos servicios de terceros como Stripe para procesamiento de pagos, Olark para soporte en vivo y YouTube para contenido integrado. Estos servicios operan bajo sus propios términos y políticas de privacidad.")}</p>

        <h2>5. {t("Seguridad de la Información")}</h2>
        <p>{t("Nos comprometemos a proteger la seguridad de su información. Sin embargo, no podemos garantizar la seguridad absoluta de nuestros servidores y contra ataques cibernéticos o interrupciones del servicio.")}</p>

        <h2>6. {t("Acceso y Control de su Información")}</h2>
        <p>{t("Los usuarios pueden acceder, corregir o eliminar su información personal contactándonos en info@backupreader.com. Además, pueden solicitar la eliminación de su cuenta y toda información asociada.")}</p>

        <h2>7. {t("Requisitos de Edad")}</h2>
        <p>{t("Los servicios de BackupReader.com están destinados a usuarios que son mayores de edad según la legislación de su país de residencia. Los menores de edad deben obtener el consentimiento de sus padres o tutores legales antes de usar nuestro servicio.")}</p>

        <h2>8. {t("Cambios en la Política de Privacidad")}</h2>
        <p>{t("Nos reservamos el derecho de modificar esta Política de Privacidad. Cualquier cambio será comunicado a través de nuestro sitio web y entrará en vigor inmediatamente después de su publicación.")}</p>

        <h2>9. {t("Contacto")}</h2>
        <p>{t("Si tiene preguntas sobre esta Política de Privacidad, por favor contáctenos en info@backupreader.com.")}</p>

        <h2>10. {t("APIs de Google")}</h2>
        <p>
        {t("Backup Reader usará y transferirá a cualquier otra aplicación la información recibida de las")+" "+t("APIs de Google")+" "} 
            {t("de acuerdo con la")+" "} 
            <Link href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes">
                <a target="_blank">{t("Política de Datos de Usuario de los Servicios de API de Google")}</a>
            </Link>
            {t(", incluidos los requisitos de Uso Limitado.")}
        </p>

        <h2>{ t("Acceso a Datos de Google Drive") }</h2>
        <p>{ t("Backup Reader requiere acceso a su Google Drive para cargar y procesar sus archivos de respaldo de redes sociales. Utilizamos la API de Google Drive para habilitar esta funcionalidad. Los usuarios otorgan permiso autorizando a Backup Reader a través de la pantalla de consentimiento de Google OAuth 2.0, donde pueden revisar y aprobar los tipos específicos de datos (por ejemplo, fotos, videos, documentos) a los que Backup Reader accederá.") }</p>
        
        <h2>{ t("Uso de Datos de Google Drive") }</h2>
        <p>{ t("Backup Reader utilizará el acceso a sus datos de Google Drive únicamente con el propósito de cargar, almacenar y procesar sus archivos de respaldo de redes sociales. Específicamente, haremos lo siguiente:") }</p>
          <p>{t("Acceder y Leer Archivos: Acceder y leer archivos que usted seleccione explícitamente y otorgue permiso en su Google Drive.")}</p>
          <p>{t("Almacenamiento de Archivos: Almacenar temporalmente los archivos seleccionados en nuestros servidores seguros para procesarlos.")}</p>
          <p>{t("Procesamiento de Archivos: Analizar y procesar los archivos almacenados para presentar los datos en un formato fácilmente legible dentro de la aplicación Backup Reader.")}</p>

        <h2>{ t("Almacenamiento de Datos de Google Drive") }</h2>
        <p>{ t("Backup Reader almacena tus archivos de respaldo de redes sociales subidos en nuestros servidores seguros durante el tiempo necesario para procesar y presentar los datos. Una vez completado el procesamiento, los archivos se eliminan de nuestros servidores. Nos aseguramos de que tus datos se almacenen de forma segura y no sean accesibles para personal no autorizado.") }</p>

        <h2>{ t("Consentimiento del Usuario") }</h2>
        <p>{ t("Al utilizar Backup Reader, consientes el acceso, uso, almacenamiento y compartición de tus datos de Google Drive según se describe en esta política de privacidad.") }</p>

        <h2>{ t("") }</h2>
        <p>{ t("") }</p>
        

        <h2>11. {t("Cifrado de Datos")}</h2>
        <p>{t("En Reposo: Backup Reader proporciona cifrado en reposo de manera predeterminada.")}</p>
        <p>{t("En Tránsito: TLS está habilitado de forma predeterminada para los datos transmitidos hacia y desde los servicios que utiliza Backup Reader.")}</p>

        <h2>12. {t("Respaldo y Recuperación de Datos")}</h2>
        <p>{t("Respaldo Automático y periódico de información para recuperación de desastres.")}</p>

        <h2>13. {t("Controles de Acceso")}</h2>
        <p>{t("Reglas de Seguridad de la Base de Datos: Nuestro sistema permite la definición de reglas de seguridad para controlar el acceso de lectura y escritura a la base de datos, asegurando que solo los usuarios autorizados puedan realizar estas acciones.")}</p>
        <p>{t("Gestión de Identidad y Acceso (IAM): Proporcionamos capacidades IAM listas para usar para gestionar el acceso a los recursos en la nube, asegurando que los usuarios tengan los permisos adecuados según sus roles.")}</p>

        <p><strong>Backup Reader LLC</strong></p>

      </div>

      </div>
  );
};
