/**
 * Las palabras que no dicen nada de una conversación.
 *
 * «de», «que», «la» y «y» son siempre las cuatro más usadas de cualquier
 * chat en español. Una lista de palabras frecuentes que empieza así no
 * informa de nada: es una propiedad del idioma, no de estas dos personas.
 *
 * Se quitan también los sonidos de risa y los «ok», «vale», «jaja», que son
 * ruido de conversación: aparecen en todos los chats y tapan lo que sí
 * distingue a este.
 *
 * NO ES CENSURA, ES UN FILTRO DE RUIDO
 * ------------------------------------
 * Nada se quita por ser malsonante o incómodo. Lo que se quita es lo que
 * aparece en todos los chats por igual.
 */

const ES = `a al algo algun alguna algunas alguno algunos ahi ahora al alla ante antes aqui asi aun aunque
bien bueno buenas buenos
cada casi como con contra cosa creo cual cuando cuanto
da dale de del desde donde dos
e el ella ellas ello ellos en entonces entre era eran eres es esa esas ese eso esos esta estaba estamos estan estar estas este esto estos estoy
fue fui
ha habia han hace hacer hasta hay he hola hoy
igual iba ir
jaja jajaja jajajaja jaja je jeje jejeje ja
la las le les lo los luego
mas me mi mientras mis mucho muy
nada ni no nos nosotros nuestra nuestro nunca
o ok osea otra otro otros
para pero poco por porque pues puede puedo
que quien quiero
se sea segun ser si siempre sin sobre solo son soy su sus
tambien tampoco tan tanto te tengo tener ti tiene tienes todo todos tu tus
un una uno unos
va vale vamos van vas ver vez vos voy
y ya yo`;

const EN = `a about after all also am an and any are as at
be because been before being but by
can cant come could
did do does doing done dont
each even ever
for from
get go going good got
had has have he her here hers him his how
i if im in into is it its
just
know
like ll lol
make me more most much my
no not now
of off ok oh on one only or other our out
really right
same say see she should so some still such
than that the their them then there these they this those though to too
up us
very
was way we well were what when where which while who why will with would
yeah yes yet you your`;

const PT = `a ai ainda algo algum alguma ao aos apenas as assim ate
bem bom
cada coisa com como
da das de dele dela depois do dos
e ela ele eles em entao esta este eu
fazer foi for
ha haja
isso isto
ja
la lhe
mais mas me mesmo meu muito
na nao nas no nos
o os ou
para pelo pode por porque pra pro
quando que quem
se sem ser seu so sua
tambem tem tudo
um uma
vai voce vou`;

/* Alemán, francés e italiano. Van aquí por lo mismo que el portugués: quien
   lee la aplicación en español puede estar en un grupo que escribe en otro
   idioma, y entonces «alles» o «anche» se colaban en «de lo que más habláis»
   como si fueran un tema. */
const DE = `aber alle allem allen aller alles als also am an andere anderem anderen anderer anderes
auch auf aus bei beim bin bis bist da damit dann das dass dem den denn der deren des dessen
dich die dies diese diesem diesen dieser dieses dir doch dort du durch ein eine einem einen
einer eines er es etwas euch euer eure für gegen gewesen hab habe haben hat hatte hatten hier
hin hinter ich ihm ihn ihnen ihr ihre ihrem ihren ihrer ihres im immer in indem ins ist jede
jedem jeden jeder jedes jene jetzt kann kannst können könnte mal man mehr mein meine mich mir
mit muss musste nach nicht nichts noch nun nur ob oder ohne schon sehr sein seine seinem seinen
seiner seines selbst sich sie sind so solche sollte sondern sonst über um und uns unser unsere
unter viel viele vom von vor war waren warum was weg weil weiter welche wenn wer werde werden
wie wieder will wir wird wirst wo wollen wollte würde zu zum zur zwar zwischen
gut gute guten ja nein heute morgen gestern mal schon echt genau klar okay`;

const FR = `alors au aucun aussi autre avant avec avoir bon car ce cela ces cet cette ceux chaque
comme comment dans des du dedans dehors depuis deux doit donc dos droite début elle elles en
encore essai est et eu fait faites fois font force haut hors ici il ils je juste la le les leur
là ma maintenant mais mes mine moins mon mot même ni nommés notre nous nouveaux ou où par parce
parole pas personnes peut peu pièce plupart pour pourquoi quand que quel quelle quelles quels
qui sa sans ses seulement si sien son sont sous soyez sujet sur ta tandis tellement tels tes ton
tous tout trop très tu valeur voie voient vont votre vous vu ça étaient état étions été être
bien bon oui non aujourd hui demain hier déjà vraiment`;

const IT = `ad agli ai al alla alle allo anche avere aveva avevano chi che ci coi col come con contro
cui da dal dalla dalle dallo degli dei del della delle dello dentro di dopo dove due ed essere
fa fare fatto fra gli ha hai hanno ho il in io la le lei li lo loro lui ma me mi mia mie mio
molto ne negli nei nel nella nelle nello noi non nostra nostro o oppure per perché più poi
qualche quale quando quanto quella quelle quelli quello questa queste questi questo qui sarà
se sei si sia siamo siete solo sono sua sue sugli sui sul sulla sulle suo suoi ti tra tu tua
tue tuo tutti tutto un una uno voi vostra vostro è
bene buono sì no oggi domani ieri già davvero`;

/** Todas las listas juntas: un chat puede mezclar idiomas. */
const TODAS = new Set(
  `${ES} ${EN} ${PT} ${DE} ${FR} ${IT}`
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
);

/**
 * Las risas y los sonidos.
 *
 * Una risa es una sílaba repetida: «ja ja ja», «je je», «ha ha». Así que se
 * busca el par (consonante + vocal) dos veces o más, con una consonante
 * suelta al final para «jajaj». Escrito como «[jh]a[jh]*a*» solo pillaba
 * «jaja» y «jajaj», y se escapaban las risas largas, que son la mayoría.
 */
const RISAS = /^(?:(?:[jh][aeiou]){2,}[jh]?|k{3,}|m{2,}|a{3,}|x+d+)$/i;

/**
 * Quita los acentos para comparar.
 *
 * Las listas van sin tildes a propósito: la gente escribe «mas» y «más», o
 * «esta» y «está», y las dos formas son la misma palabra de relleno. La «ñ»
 * sí se respeta, que ahí sí cambia la palabra.
 */
const sinTildes = (p: string) =>
  p
    .normalize("NFD")
    .replace(/ñ/g, "ñ")
    .replace(/[̀-ͯ]/g, "");

/** ¿Es una palabra de las que aparecen en todos los chats? */
export function esRuido(palabra: string): boolean {
  const p = sinTildes(palabra.toLowerCase());
  /* Una o dos letras nunca dicen nada por sí solas. */
  if (p.length <= 2) return true;
  if (TODAS.has(p)) return true;
  if (RISAS.test(p)) return true;
  /* Números sueltos: una hora o un precio, no una palabra del chat. */
  if (/^\d+$/.test(p)) return true;
  return false;
}
