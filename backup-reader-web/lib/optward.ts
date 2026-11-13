/**
 * Aviso de cookies de Optward (repo thefutureforward/consent-backend).
 *
 * QUÉ HACE
 * --------
 * El banner es un script que sirve el backend de Optward. La página solo le
 * dice qué sitio es (`siteId`) y dónde está el backend (`apiBase`); colores,
 * textos y categorías los descarga de ahí, así que se cambian desde el
 * dashboard de Optward sin tocar este código.
 *
 * Se activa con variables de entorno. Sin NEXT_PUBLIC_OPTWARD_SITE_ID no se
 * emite NADA de esto y la página queda exactamente como antes: un Consent
 * Mode denegado sin banner que lo pueda conceder dejaría la analítica muerta
 * sin que nadie pudiera aceptarla.
 *
 * EL ORDEN IMPORTA
 * ----------------
 * El bloque de Consent Mode tiene que ir ANTES que Google Tag Manager. El
 * banner llega por red (async) y para entonces GTM ya habría arrancado sin
 * saber nada del consentimiento. Por eso este bloque va inline, en el <head>,
 * lo primero. Es el mismo que genera el dashboard en Instalar ->
 * «Código para el sitio» (función bloqueConsentMode de dashboard.html),
 * escrito aquí a partir de la config.
 *
 * LA CONFIG DEL SITIO VIVE EN docs/optward-config.json
 * --------------------------------------------------
 * Ese archivo es lo que hay que pegar en el dashboard de Optward, pestaña
 * Config, para el sitio de Backup Reader. De ahí lee el banner los textos,
 * colores y categorías.
 *
 * Y el bloque inline de aquí abajo saca de ESE MISMO archivo el namespace,
 * la versión y las categorías, para que los dos no se puedan desincronizar
 * desde este lado. Lo que sí hay que hacer a mano es lo contrario: si se
 * cambia algo de eso en el dashboard, copiarlo también al JSON. Si no, al
 * recargar la página la decisión previa no se reaplica hasta que llega el
 * banner (medio segundo de etiquetas con el permiso equivocado).
 */

import configSitio from "../docs/optward-config.json";

export const OPTWARD_SITE_ID = (process.env.NEXT_PUBLIC_OPTWARD_SITE_ID || "").trim();

/** Donde vive el backend (el mismo origen que el dashboard). Sin barra final. */
export const OPTWARD_API = (process.env.NEXT_PUBLIC_OPTWARD_URL || "https://optward.com")
  .trim()
  .replace(/\/+$/, "");

export const OPTWARD_ACTIVO = /^site_[a-z0-9]+$/i.test(OPTWARD_SITE_ID);

const NAMESPACE: string = configSitio.namespace;
const VERSION: string = configSitio.consentVersion;

/** Categoría -> señales de Consent Mode, como en la config del sitio. */
const CATEGORIAS: Array<{ id: string; locked: boolean; signals: string[] }> =
  configSitio.categories.map((c) => ({ id: c.id, locked: c.locked, signals: c.signals }));

/** Para meter un valor en un <script> inline sin que pueda cerrar la etiqueta. */
const js = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/**
 * Consent Mode v2 denegado por defecto, con la decisión previa ya aplicada si
 * la hay (leída de la cookie del banner). Va antes que GTM.
 */
export function bloqueConsentMode(): string {
  const mapa: Record<string, string[]> = {};
  let locked: string[] = [];
  for (const c of CATEGORIAS) {
    mapa[c.id] = c.signals;
    if (c.locked) locked = locked.concat(c.signals);
  }
  return `(function(){
var NS=${js(NAMESPACE)},VERSION=${js(VERSION)},MAP=${js(mapa)};
var LOCKED=${js(locked)};
var ALL=["ad_storage","ad_user_data","ad_personalization","analytics_storage","functionality_storage","personalization_storage","security_storage"];
window.dataLayer=window.dataLayer||[];
function gtag(){window.dataLayer.push(arguments)}
if(typeof window.gtag!=="function")window.gtag=gtag;
var prev=null;try{var m=document.cookie.match(new RegExp("(?:^|; )"+NS+"_cookie_consent=([^;]*)"));
if(m){var c=JSON.parse(decodeURIComponent(m[1]));if(c&&c.version===VERSION)prev=c}}catch(e){}
var d={};ALL.forEach(function(s){d[s]="denied"});
LOCKED.forEach(function(s){d[s]="granted"});
if(prev&&prev.categories){Object.keys(MAP).forEach(function(k){
if(prev.categories[k])MAP[k].forEach(function(s){d[s]="granted"})})}
d.wait_for_update=500;
gtag("consent","default",d);
gtag("set","ads_data_redaction",d.ad_storage!=="granted");
window.__consentDefaultSet=true;
})();`;
}

/**
 * Qué sitio es y dónde está el backend, más el idioma que eligió el visitante
 * en la app (cookie `br_lang`, la misma que escribe `cambiarIdioma` en
 * i18n.js). Sin esto el banner miraría solo el idioma del navegador y podría
 * salir en inglés a quien pulsó ES.
 */
export function bloqueConfig(): string {
  return `window.__consentConfig={siteId:${js(OPTWARD_SITE_ID)},apiBase:${js(OPTWARD_API)}};
try{var l=(document.cookie.match(/(?:^|;\\s*)br_lang=([^;]*)/)||[])[1]||localStorage.getItem("br_lang");if(l==="es"||l==="en")window.__consentLang=l}catch(e){}`;
}

export const OPTWARD_BUNDLE = `${OPTWARD_API}/consent-banner.js`;

/** Cambia el idioma del banner si ya está cargado. Lo llama `cambiarIdioma`. */
export function idiomaDelAviso(idioma: string): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.__consentLang = idioma;
  try {
    w.ConsentBanner?.setLanguage?.(idioma);
  } catch (e) {}
}

/** Reabre el panel de preferencias. Para el enlace del pie de página. */
export function abrirPreferenciasDeCookies(): void {
  if (typeof window === "undefined") return;
  try {
    (window as any).ConsentBanner?.open?.();
  } catch (e) {}
}
