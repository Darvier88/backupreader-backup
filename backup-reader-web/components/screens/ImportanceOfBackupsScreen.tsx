import { Typography, Button } from "@mui/material";
import { Grid, Spacer } from "@nextui-org/react";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import Image from 'next/image';
import {TwoCards, SimpleCard} from '../cards';



export const ImportanceOfBackups: FC = () => {

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
    },
    featuresList: {
      listStyle: 'none'
    }
  };

  return (
    <div className="br-root">

      <div className="br-prose">
        <h1>{t("Beneficios del respaldo de información")}</h1>
        <Spacer y={1} />
        <p>{t("Hoy, queremos resaltar la importancia de realizar copias de seguridad de tus datos con tiempo para garantizar la seguridad, privacidad y mantener tus recuerdos a salvo. Aquí te presentamos tres motivos convincentes para que tomes acción y protejas tus valiosos activos digitales:")}</p>
        <ul style={styles.featuresList}>
            <li>
              <TwoCards
                video=""
                image="/images/seguridad-de-datos.svg"
                title={t("Seguridad frente a amenazas digitales")}
                text={t("Vivimos en una era en la que el ciberespacio está lleno de amenazas, como virus, ransomware y hackers maliciosos. Estos ataques pueden dañar o eliminar por completo tus archivos, dejándote con una sensación devastadora de pérdida. Al realizar copias de seguridad periódicas, te aseguras de que, incluso si sufres un ataque, puedas recuperar tus datos sin problemas.")}
                orientation="left"
                width={300}
                height={300}
                alt={""}
              />
            </li>
            <li>
              <TwoCards
                image="/images/privacidad-y-control.svg"
                video=""
                title={t("Privacidad y control")}
                text={t("Tu información personal es valiosa y delicada. Sin un respaldo adecuado, te expones al riesgo de pérdida de datos o de que tu información se vea comprometida. Al hacer copias de seguridad en dispositivos físicos externos o en servicios de almacenamiento en la nube con medidas de seguridad sólidas, mantienes el control total sobre tus datos y preservas tu privacidad.")}
                orientation="right"
                width={300}
                height={300}
                alt={""}
              />
            </li>
            <li>
                <TwoCards 
                  video=""
                  image="/images/preservacion-de-recuerdos-importantes.svg"
                  title={t("Preservación de recuerdos y documentos importantes")}
                  text={t("¿Cuántos recuerdos preciados atesoras en tus dispositivos? Fotografías de momentos especiales, videos familiares, cartas significativas, todos estos objetos digitales cuentan una parte única de tu historia. Hacer copias de seguridad garantiza que estos recuerdos estén protegidos y que puedas revivirlos en el futuro. No esperes a que sea demasiado tarde. La prevención es clave. Toma acción ahora y establece un plan de respaldo para tus dispositivos. Programa copias de seguridad periódicas y considera utilizar varias formas de almacenamiento para una protección adicional.")}                
                  orientation="left"
                  width={300}
                  height={300}
                  alt={""}
                />
            </li>
        </ul>
      </div>

      <SimpleCard 
          title={t("Respalda tus recuerdos")}
          text={t("Crea una cuenta en Backup Reader y empieza a respaldar tus conversaciones.")}
          image={''}
          ctaLabel={t("Empezar ahora")}
          ctaRoute={'/auth'}
          background={true}
        />
        

      </div>
  );
};
