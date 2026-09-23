import { FC, useContext, useEffect, useState } from "react";
import { InformationCard } from ".";
import { useForm } from "../../hooks";
import { useRouter } from "next/router";
import { Plan } from "../../models/Plan";
import { useTranslation } from "react-i18next";
import { FirestoreContext } from "../../context";
import { Loading } from "@nextui-org/react";
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import Stripe from "stripe";

/* ============================================================================
   Pago — rediseño "Expediente". Se REESCRIBE solo el JSX; toda la lógica de
   Stripe (createPaymentMethod, creación de cliente y suscripción, estados y
   validación) se conserva idéntica.
   ============================================================================ */

const serif = "var(--font-serif)";
const mono = "var(--font-mono)";

const stripeElementOptions = {
  style: {
    base: {
      fontSize: "15px",
      color: "#1F2933",
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      "::placeholder": { color: "#8A94A0" },
    },
  },
};

export const PaymentCard: FC = () => {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();

  const [planToPay, setPlanToPay] = useState<Plan>();
  const [customer, setCustomer] = useState<Stripe.Customer | null>(null);
  const [payResult, setPayResult] = useState<
    "starting" | "checking" | "success" | "denied"
  >("starting");
  const { formState, setFormState } = useForm({
    name: "",
    email: "",
  });
  const { subscription, user, planId, updateUser } =
    useContext(FirestoreContext);

  const createPayment = async () => {
    if (!planToPay?.details.price) return;

    // Create a payment method
    const { error, paymentMethod } = await stripe?.createPaymentMethod({
      type: "card",
      card: elements?.getElement(CardNumberElement)!,
      billing_details: {
        name: formState.name,
        email: formState.email,
      },
    }) ?? {};

    const createCustomer = async () => {
      try {
        const response = await fetch('/api/customer/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: formState.name, email: formState.email }),
        });

        if (response.ok) {
          const data = await response.json();
          const customerId = data.customerId;
          const price = planToPay?.details.price;
          let priceID;

          //After creating a custumer I execute the subscription
          if (error) {
            console.error(error);
            setPayResult("denied");
          } else {
            // Payment method created successfully
            if (price == 2.99) {
              priceID = "price_1NM0cTF3VaqMsYUWuhKmsf4b";
            } else if (price == 3.99) {
              priceID = "price_1NM0jtF3VaqMsYUWZfyUP0Om";
            } else {
              priceID = "price_1NM0kNF3VaqMsYUWT7Mj25xr";
            }
            createSubscription(customerId, paymentMethod!.id, priceID);
          }
        } else {
          const errorData = await response.json();
          console.error('No se pudo crear un customer: ' + errorData.error);
        }
      } catch (error) {
        console.error('Hubo un error general ' + error);
      }
    };

    createCustomer();
  };

  const createSubscription = async (customerId: string, paymentMethodId: string, planId: string) => {
    console.log('Enviando los siguientes parametros ' + customerId + ' plan id: ' + paymentMethodId + ' user id: ' + planId);
    const res = await fetch("/api/subscriptions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerId,
        paymentMethodId: paymentMethodId,
        planId: planId,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setPayResult("success");
      if (user?.uid && planToPay?.id) {
        console.log('Envie el customer nano, el cual es ', data);
        updateUser(user.uid, planToPay?.id, formState.name);
        router.replace("/dashboard");
      }
    } else {
      console.error(data.error);
      setPayResult("denied");
    }
  };

  useEffect(() => {
    if (!planId || !subscription) return;
    subscription.forEach((item) => {
      if (item.id === planId) {
        setPlanToPay(item);
      }
    });
  }, []);

  const isValidForm = () => {
    const { email, name } = formState;
    if (!validateEmail(email)) return true;
    if (name.length <= 0) return true;
    if (containsNumbers(name)) return true;
    return false;
  };

  const containsNumbers = (str: string) => {
    return /\d/.test(str);
  };

  const validateEmail = (value: string) => {
    if (
      value.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,4}$/i)?.input ===
      formState.email
    ) {
      return true;
    } else return false;
  };

  const onHandleCreatePay = () => {
    createPayment();
    setPayResult("checking");
  };

  const stripeField = (label: string, el: JSX.Element) => (
    <div className="br-field">
      <label className="br-label">{label}</label>
      <div className="br-input" style={{ display: "flex", alignItems: "center", minHeight: 46 }}>
        <div style={{ width: "100%" }}>{el}</div>
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", maxWidth: 460, margin: "0 auto" }}>
      {(payResult === "starting" || payResult === "checking") ? (
        <>
          <h1 className="br-page-title">{t("Información de pago")}</h1>
          <p className="br-page-sub">
            {t("Plan")} {planToPay?.details.name} · ${planToPay?.details.price} {t("al mes")}.{" "}
            <span className="br-link" style={{ cursor: "pointer" }} onClick={() => router.push("/plans")}>{t("Cambiar plan")}</span>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="br-field">
              <label className="br-label">{t("Nombre en la tarjeta")}</label>
              <input className="br-input" disabled={payResult === "checking"} placeholder={t("Como aparece en la tarjeta")} onChange={(e) => setFormState("name", e.target.value)} />
            </div>
            <div className="br-field">
              <label className="br-label">{t("Correo electrónico")}</label>
              <input className="br-input" type="email" disabled={payResult === "checking"} placeholder={t("tucorreo@email.com")} onChange={(e) => setFormState("email", e.target.value)} />
            </div>
            {stripeField(t("Número de tarjeta"), <CardNumberElement options={{ ...stripeElementOptions, showIcon: true, placeholder: "0000 0000 0000 0000" }} />)}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {stripeField(t("Fecha de vencimiento"), <CardExpiryElement options={{ ...stripeElementOptions, placeholder: "MM / AA" }} />)}
              {stripeField("CVC", <CardCvcElement options={{ ...stripeElementOptions, placeholder: "123" }} />)}
            </div>
          </div>

          {/* Resumen del pedido */}
          <div className="br-card" style={{ marginTop: 30, padding: "20px 22px" }}>
            <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--slate-500)" }}>{t("Resumen del pedido")}</span>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 15.5, color: "var(--slate-700)" }}>{t("Plan")} {planToPay?.details.name} — {t("suscripción mensual")}</span>
              <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: "var(--ink-900)" }}>${planToPay?.details.price}</span>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 15.5, color: "var(--text-strong)", fontWeight: 600 }}>{t("A pagar hoy")}</span>
              <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: "var(--ink-900)" }}>${planToPay?.details.price}</span>
            </div>
          </div>

          {/* Botones */}
          <div style={{ marginTop: 26, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
            {payResult === "checking" ? (
              <div style={{ width: "100%", display: "flex", justifyContent: "center", padding: "8px 0" }}>
                <Loading loadingCss={{ $$loadingSize: "40px", $$loadingBorder: "4px" }} />
              </div>
            ) : (
              <>
                <button className="br-btn br-btn-ghost br-btn-md" onClick={() => router.back()}>{t("Cancelar")}</button>
                <button
                  className="br-btn br-btn-primary br-btn-lg"
                  disabled={isValidForm()}
                  style={{ opacity: isValidForm() ? 0.5 : 1, cursor: isValidForm() ? "not-allowed" : "pointer" }}
                  onClick={onHandleCreatePay}
                >
                  {t("Suscribirte")}
                </button>
              </>
            )}
          </div>

          <p className="br-fineprint" style={{ marginTop: 22 }}>
            {t("Los pagos se procesan por nuestro proveedor de pago. Nunca guardamos los datos de tu tarjeta.")}
          </p>
        </>
      ) : payResult === "denied" ? (
        <InformationCard
          title={t("Pago no realizado, por favor verifica los datos ingresados.")}
          icon="denied"
          onPress={() => setPayResult("starting")}
        />
      ) : (
        <></>
      )}
    </div>
  );
};
