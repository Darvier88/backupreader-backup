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

import { precioDeStripe } from "../../lib/precios-de-planes";

/* ============================================================================
   Pago — rediseño "Expediente".

   Añadido: código de descuento. El usuario lo escribe, pulsa "Aplicar", y el
   servidor lo valida contra Stripe y devuelve cuánto va a pagar. El resumen
   del pedido pasa a enseñar ese total ANTES de cobrar nada, que es el punto:
   nadie debería pulsar "Suscribirte" sin saber cuánto se le va a cobrar.

   El código se manda también al crear la suscripción, y allí se vuelve a
   validar. No es paranoia: entre "Aplicar" y "Suscribirte" pueden pasar
   minutos, y en ese rato el código puede agotarse o vencer. Si eso ocurre,
   el cobro se aborta y se avisa, en vez de cobrar el precio entero a quien
   acaba de ver un total con descuento.
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

/** Lo que devuelve /api/discounts/validate cuando el código sirve. */
type Descuento = {
  codigo: string;
  moneda: string;
  precioCentavos: number;
  totalCentavos: number;
  ahorroCentavos: number;
  gratisHoy: boolean;
  descripcion: string;
  claveDescripcion?: string;
  cantidad?: string;
  meses?: number | null;
  aviso: string | null;
};

const dinero = (centavos: number) => (centavos / 100).toFixed(2);

/**
 * `t()` puede devolver null según sus tipos, así que no encaja donde se espera
 * un string. El proyecto lo ignora en otros sitios porque el build salta la
 * validación de tipos, pero el código nuevo no tiene por qué sumar más ruido:
 * esto lo resuelve donde hace falta sin tocar las líneas que ya estaban.
 */
const enTexto = (traducido: unknown): string =>
  (traducido as string | null | undefined) ?? "";

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

  /* --- Código de descuento --- */
  const [codigo, setCodigo] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [descuento, setDescuento] = useState<Descuento | null>(null);
  const [errorDeCodigo, setErrorDeCodigo] = useState("");
  /* Un fallo del cobro causado por el código, no por la tarjeta. Se guarda
     aparte para que el mensaje de error no mande al usuario a revisar una
     tarjeta que está perfecta. */
  const [fallaPorCodigo, setFallaPorCodigo] = useState("");

  const precioStripe = precioDeStripe(planToPay?.details.price);

  const aplicarCodigo = async () => {
    const texto = codigo.trim();
    if (!texto) return;

    setAplicando(true);
    setErrorDeCodigo("");
    try {
      const r = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: texto, priceId: precioStripe }),
      });
      const data = await r.json();

      if (data?.ok) {
        setDescuento(data as Descuento);
      } else {
        setDescuento(null);
        /* `motivo` viene en palabras desde el servidor (vencido, agotado,
           importe mínimo). Si no viene, el fallo es de la aplicación y no del
           código, así que el mensaje no culpa al usuario. */
        setErrorDeCodigo(
          data?.motivo
            ? enTexto(t(data.motivo))
            : enTexto(t("No pudimos comprobar el código ahora mismo. Inténtalo de nuevo."))
        );
      }
    } catch {
      setDescuento(null);
      setErrorDeCodigo(
        enTexto(t("No pudimos comprobar el código ahora mismo. Inténtalo de nuevo."))
      );
    } finally {
      setAplicando(false);
    }
  };

  const quitarCodigo = () => {
    setDescuento(null);
    setCodigo("");
    setErrorDeCodigo("");
    setFallaPorCodigo("");
  };

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
          /* El uid viaja para quedar en metadata del cliente de Stripe. Es lo
             que permite encontrarlo al cancelar sin depender del correo. */
          body: JSON.stringify({
            name: formState.name,
            email: formState.email,
            uid: user?.uid,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const customerId = data.customerId;

          //After creating a custumer I execute the subscription
          if (error) {
            console.error(error);
            setPayResult("denied");
          } else {
            // Payment method created successfully
            createSubscription(customerId, paymentMethod!.id, precioStripe);
          }
        } else {
          const errorData = await response.json();
          console.error('No se pudo crear un customer: ' + errorData.error);
          setPayResult("denied");
        }
      } catch (error) {
        console.error('Hubo un error general ' + error);
        setPayResult("denied");
      }
    };

    createCustomer();
  };

  const createSubscription = async (customerId: string, paymentMethodId: string, planId: string) => {
    const res = await fetch("/api/subscriptions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerId,
        paymentMethodId: paymentMethodId,
        planId: planId,
        /* El texto del código, no el id que devolvió la validación: el
           servidor lo resuelve otra vez contra Stripe. */
        discountCode: descuento ? descuento.codigo : undefined,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setPayResult("success");
      if (user?.uid && planToPay?.id) {
        updateUser(user.uid, planToPay?.id, formState.name);
        /* A la confirmacion (6b), no al panel.
           Ir directo al panel hacia que el cobro desapareciera sin acuse:
           acabas de pagar y lo siguiente que ves es la aplicacion, sin que
           nada te diga a que correo va el recibo ni cuando es el proximo
           cargo. Y la clave de cifrado aparecia de sopeton, que es la peor
           forma de presentar algo que, si se pierde, deja los chats
           irrecuperables. */
        router.replace("/plan-activo");
      }
    } else if (data.codigoRechazado) {
      /* El cobro no se hizo y no se creó ninguna suscripción. Se vuelve al
         formulario con el código quitado y el motivo a la vista, para que se
         pueda reintentar sin él. */
      setDescuento(null);
      setFallaPorCodigo(
        data.motivo
          ? enTexto(t(data.motivo))
          : enTexto(t("Ese código ya no se puede usar. Prueba sin él."))
      );
      setPayResult("starting");
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
    setFallaPorCodigo("");
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

  /* El precio del plan tal como lo conoce la aplicación. Cuando hay descuento
     se usa el que devolvió Stripe, que es el que manda. */
  const precioCentavos = descuento
    ? descuento.precioCentavos
    : Math.round((planToPay?.details.price ?? 0) * 100);
  const totalCentavos = descuento ? descuento.totalCentavos : precioCentavos;

  /**
   * Se puede llegar a esta pantalla sin plan en el contexto —entrando directo
   * a /payment, o recargando— y entonces no hay precio que cobrar.
   *
   * Importa distinguirlo de un precio de cero. Al pasar los importes a
   * centavos, un plan ausente daba `$0.00` en el resumen: un precio que
   * parece de verdad y que no lo es. Antes salía `$undefined`, que era feo
   * pero al menos no engañaba. Así que sin plan se enseña una raya y el botón
   * queda desactivado, que es lo que ya hacía de hecho —`createPayment`
   * vuelve enseguida si no hay precio— pero sin que el botón lo disimule.
   */
  const sinPlan = !planToPay?.details.price;

  return (
    <div style={{ width: "100%", maxWidth: 460, margin: "0 auto" }}>
      {(payResult === "starting" || payResult === "checking") ? (
        <>
          <h1 className="br-page-title">{t("Información de pago")}</h1>
          <p className="br-page-sub">
            {/* Sin plan, la frase entera sobra: "Plan al mes." no dice nada.
                El aviso de más abajo es el que explica qué pasa. */}
            {sinPlan
              ? null
              : `${t("Plan")} ${planToPay?.details.name} · $${planToPay?.details.price} ${t("al mes")}. `}
            <span className="br-link" style={{ cursor: "pointer" }} onClick={() => router.push("/plans")}>{t("Cambiar plan")}</span>
          </p>

          {fallaPorCodigo && (
            <div
              className="br-card"
              style={{ marginBottom: 18, padding: "12px 16px", borderColor: "var(--aviso-borde)" }}
            >
              <span style={{ fontSize: 14, color: "var(--aviso-texto)" }}>{fallaPorCodigo}</span>
            </div>
          )}

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

            {/* Código de descuento */}
            <div className="br-field">
              <label className="br-label">{t("Código de descuento")}</label>
              {descuento ? (
                <div
                  className="br-input"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    minHeight: 46,
                  }}
                >
                  <span style={{ fontFamily: mono, fontSize: 14 }}>
                    {descuento.codigo}
                  </span>
                  <span
                    className="br-link"
                    style={{ cursor: "pointer", fontSize: 14 }}
                    onClick={quitarCodigo}
                  >
                    {t("Quitar")}
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    className="br-input"
                    style={{ flex: 1, textTransform: "uppercase" }}
                    disabled={payResult === "checking" || aplicando}
                    placeholder={enTexto(t("Si tienes uno"))}
                    value={codigo}
                    onChange={(e) => {
                      setCodigo(e.target.value);
                      setErrorDeCodigo("");
                    }}
                    /* Enter aplica el código en vez de enviar el formulario:
                       sin esto, pulsar Enter en este campo intentaría pagar. */
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        aplicarCodigo();
                      }
                    }}
                  />
                  <button
                    className="br-btn br-btn-ghost br-btn-md"
                    type="button"
                    disabled={!codigo.trim() || aplicando || sinPlan || payResult === "checking"}
                    style={{
                      opacity: !codigo.trim() || aplicando ? 0.5 : 1,
                      cursor: !codigo.trim() || aplicando ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                    onClick={aplicarCodigo}
                  >
                    {aplicando ? t("Comprobando…") : t("Aplicar")}
                  </button>
                </div>
              )}
              {errorDeCodigo && (
                <span style={{ fontSize: 13, color: "var(--aviso-texto)", marginTop: 6, display: "block" }}>
                  {errorDeCodigo}
                </span>
              )}
              {descuento?.aviso && (
                <span style={{ fontSize: 13, color: "var(--slate-500)", marginTop: 6, display: "block" }}>
                  {enTexto(t(descuento.aviso))}
                </span>
              )}
            </div>
          </div>

          {/* Resumen del pedido */}
          <div className="br-card" style={{ marginTop: 30, padding: "20px 22px" }}>
            <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--slate-500)" }}>{t("Resumen del pedido")}</span>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 15.5, color: "var(--slate-700)" }}>{t("Plan")} {planToPay?.details.name} — {t("suscripción mensual")}</span>
              <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: "var(--ink-900)" }}>{sinPlan ? "—" : `$${dinero(precioCentavos)}`}</span>
            </div>

            {descuento && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
                  <span style={{ fontSize: 15.5, color: "var(--slate-700)" }}>
                    {t("Descuento")} ({descuento.codigo})
                  </span>
                  <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: "#2E7D5B" }}>
                    −${dinero(descuento.ahorroCentavos)}
                  </span>
                </div>
                {/* Cuánto dura. Un cupón de un solo mes rebaja el primer cobro
                    y nada más; sin decirlo, el segundo recibo parecería un
                    error de cobro. */}
                <span style={{ fontSize: 13, color: "var(--slate-500)" }}>
                  {/* Se arma aquí y no en el servidor: en inglés el orden de
                      la frase cambia, así que hace falta una frase entera por
                      caso con la cifra como variable. Si llegara un cupón con
                      una duración no contemplada, se cae a la versión en
                      español que el servidor manda de respaldo. */}
                  {descuento.claveDescripcion
                    ? enTexto(
                        t(descuento.claveDescripcion, {
                          cantidad: descuento.cantidad ?? "",
                          meses: descuento.meses ?? 0,
                        } as any)
                      )
                    : descuento.descripcion}
                </span>
              </div>
            )}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 15.5, color: "var(--text-strong)", fontWeight: 600 }}>{t("A pagar hoy")}</span>
              <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: "var(--ink-900)" }}>
                {sinPlan ? "—" : descuento?.gratisHoy ? t("Gratis") : `$${dinero(totalCentavos)}`}
              </span>
            </div>

            {descuento?.gratisHoy && (
              /* Con un cupón del 100% hoy no se cobra nada, pero la tarjeta se
                 guarda: cuando el descuento se acabe hay que poder cobrar la
                 renovación. Decirlo evita la sensación de cargo sorpresa. */
              <span style={{ fontSize: 13, color: "var(--slate-500)", marginTop: 10, display: "block" }}>
                {t("Hoy no se te cobra nada. Guardamos tu tarjeta para cuando el descuento termine, y puedes cancelar antes.")}
              </span>
            )}
          </div>

          {sinPlan && (
            /* Sin plan no hay nada que cobrar. Se dice y se ofrece la salida,
               en vez de dejar un formulario que no puede terminar. */
            <p style={{ marginTop: 16, fontSize: 14, color: "var(--aviso-texto)" }}>
              {t("No hay un plan seleccionado.")}{" "}
              <span className="br-link" style={{ cursor: "pointer" }} onClick={() => router.push("/plans")}>
                {t("Elige un plan")}
              </span>
            </p>
          )}

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
                  disabled={isValidForm() || sinPlan}
                  style={{
                    opacity: isValidForm() || sinPlan ? 0.5 : 1,
                    cursor: isValidForm() || sinPlan ? "not-allowed" : "pointer",
                  }}
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
