import { FC } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useTranslation } from "react-i18next";
import { PaymentCard } from "../cards";

/* ============================================================================
   Pago — rediseño "Expediente". Se conserva intacto el envoltorio de Stripe
   (<Elements>) y el componente <PaymentCard/> con toda su lógica de pago.
   Solo se añade el layout de dos columnas con el aside ilustrado.
   ============================================================================ */

const stripePromise = loadStripe(`${process.env.NEXT_PUBLIC_STRIPE_KEYP}`);

const asideItems = (t: (k: string) => string) => [
  { img: "/redesign/cancel-at-any-time.svg", title: t("Cancela cuando quieras"), text: t("Sin contratos ni penalizaciones. Detén tu suscripción desde tu cuenta cuando lo decidas.") },
  { img: "/redesign/information-will-always-be-yours.svg", title: t("Tu información siempre será tuya"), text: t("Tú decides qué guardar y qué borrar. Elimina tu cuenta y todo lo que contiene se va contigo.") },
];

export const PaymentScreen: FC = () => {
  const { t } = useTranslation();
  return (
    <Elements stripe={stripePromise}>
      <div className="br-root br-split">
        <div className="br-split-main" style={{ display: "flex", justifyContent: "center" }}>
          <PaymentCard />
        </div>
        <aside className="br-aside">
          <div className="br-aside-inner">
            {asideItems(t).map((it, i) => (
              <div key={i} className="br-aside-item">
                <img src={it.img} alt="" />
                <h2>{it.title}</h2>
                <p>{it.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Elements>
  );
};
