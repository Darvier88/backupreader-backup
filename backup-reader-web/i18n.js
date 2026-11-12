import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector"; 

const resources = {
  en: {
    translation: {
      /* Rediseño, revisión de flujos (rondas 1–9) */
      "Exportar chat": "Export chat",
      "Borrar búsqueda": "Clear search",
      "Personas o mensajes en tus {{n}} chats": "People or messages in your {{n}} chats",
      "Todo · {{n}}": "All · {{n}}",
      "Hasta {{n}} MB por conversación": "Up to {{n}} MB per conversation",
      "Volver": "Back",
      "Reenviar en": "Resend in",
      "excelente": "excellent",
      "buena": "good",
      "débil": "weak",
      "Plan Personal": "Personal plan",
      "$2.99/mes · recibo enviado": "$2.99/mo · receipt sent",
      "Fuerza: {{fuerza}}": "Strength: {{fuerza}}",
      "Guardar clave y empezar": "Save key and start",
      "Hasta que elijas tu contraseña de cifrado no se pueden subir chats nuevos: se cifran en tu navegador antes de salir, y sin esa contraseña no hay con qué cifrarlos.": "Until you choose your encryption password you can't upload new chats: they're encrypted in your browser before leaving it, and without that password there's nothing to encrypt them with.",
      "Tus chats están aquí, cerrados. Escribe tu clave de cifrado para leerlos.": "Your chats are here, locked. Enter your encryption key to read them.",
      "Subir": "Upload",
      "Empieza aquí": "Start here",
      "Abierto hoy": "Opened today",
      "Abierto ayer": "Opened yesterday",
      "Abierto {{fecha}}": "Opened {{fecha}}",
      "Ver resultados de todos los chats": "Show results from all chats",
      "Solo {{chat}}": "Only {{chat}}",
      "Más recientes primero": "Newest first",
      "Más antiguos primero": "Oldest first",
      "Tus chats, cifrados": "Your chats, encrypted",
      "Entra en segundos. Si es tu primera vez, creamos tu cuenta.": "Sign in in seconds. If it's your first time, we'll create your account.",
      "¿La olvidaste?": "Forgot it?",
      "El cobro empieza hoy. Cancela desde tu cuenta cuando quieras.": "Billing starts today. Cancel from your account whenever you want.",
      "Abrir el panel de chats": "Open the chats panel",
      "Tus chats": "Your chats",
      "Último paso": "Last step",
      "Una vez más.": "One more time.",
      "Clave creada": "Key created",
      "Guarda tu código.": "Save your code.",
      "Clave guardada": "Key saved",
      "Con ella ciframos tus chats en tu teléfono antes de guardarlos. Nosotros no la conocemos.": "We use it to encrypt your chats on your phone before saving them. We never know it.",
      "Con ella ciframos tus chats en tu dispositivo antes de guardarlos. Nosotros no la conocemos.": "We use it to encrypt your chats on your device before saving them. We never know it.",
      "Hola de nuevo, {{nombre}}": "Welcome back, {{nombre}}",
      "Escribe tu clave de cifrado para abrirlos y subir nuevos.": "Enter your encryption key to open them and upload new ones.",
      "Recordar en este dispositivo por 30 días": "Remember on this device for 30 days",
      "No la marques en un computador compartido.": "Don't check this on a shared computer.",
      "Olvidé mi clave de cifrado": "I forgot my encryption key",
      "Usar mi clave": "Use my key",
      "Este dispositivo recuerda tu clave de cifrado hasta 30 días.": "This device remembers your encryption key for up to 30 days.",
      "Olvidar este dispositivo": "Forget this device",
      "Esa clave no abre tus chats. Inténtalo de nuevo.": "That key doesn't open your chats. Try again.",
      "Es distinta a la contraseña de tu cuenta.": "It's different from your account password.",
      "Términos y Condiciones de Backup Reader LLC para BackupReader.com":"Terms and Conditions of Backup Reader LLC for BackupReader.com",
      "Fecha de Última Actualización: 23 de Enero de 2024":"Last Updated: January 23, 2024",
      "Backup Reader LLC":"Backup Reader LLC",
      "1. Aceptación de los Términos":"1. Acceptance of Terms",
      "Al acceder y utilizar BackupReader.com, propiedad de Backup Reader LLC, usted acuerda estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguno de los términos y condiciones aquí presentados, por favor no utilice ni acceda a este sitio web.":"By accessing and using BackupReader.com, owned by Backup Reader LLC, you agree to be bound by these Terms and Conditions. If you do not agree with any of the terms and conditions presented here, please do not use or access this website.",
      "2. Recopilación y Uso de Información":"2. Collection and Use of Information",
      "Google Analytics:":"Google Analytics:",
      "Utilizamos Google Analytics para recopilar información sobre el comportamiento de los visitantes en nuestro sitio. Esta información nos ayuda a mejorar la experiencia del usuario. Google Analytics recopila información anónima que no lo identifica personalmente.":"We use Google Analytics to collect information about visitor behavior on our site. This information helps us improve the user experience. Google Analytics collects anonymous information that does not personally identify you.",
      "Información Subida por el Usuario:":"User-Uploaded Information:",
      "Almacenamos la información que los usuarios suben voluntariamente a BackupReader.com. Esto puede incluir, pero no está limitado a, datos personales, fotografías, y otros contenidos.":"We store the information that users voluntarily upload to BackupReader.com. This may include, but is not limited to, personal data, photographs, and other content.",
      "Acceso del Personal Técnico:":"Technical Staff Access:",
      "Nuestro personal técnico puede tener acceso a su información para el mantenimiento y mejora del sitio. Este acceso está regulado y se realiza bajo estrictas medidas de seguridad.":"Our technical staff may have access to your information for site maintenance and improvement. This access is regulated and carried out under strict security measures.",
      "3. Eliminación de Información y Cuenta":"3. Deletion of Information and Account",
      "Usted puede solicitar la eliminación de su cuenta y toda la información asociada enviando un correo electrónico a info@backupreader.com. Tras recibir su solicitud, procederemos a eliminar su información de nuestros registros de manera oportuna.":"You may request the deletion of your account and all associated information by sending an email to info@backupreader.com. Upon receiving your request, we will proceed to delete your information from our records in a timely manner.",
      "4. Seguridad":"4. Security",
      "Nos comprometemos a proteger la seguridad de su información. Implementamos medidas técnicas y organizativas adecuadas para proteger sus datos contra el acceso no autorizado, la alteración, la divulgación o la destrucción. Sin embargo, es importante destacar que, mientras tomamos todas las precauciones posibles, no podemos garantizar que nuestros servidores estén completamente exentos de hackeos o interrupciones del servicio. Reconocemos que ninguna medida de seguridad es infalible, y por tanto, no podemos asegurar una protección absoluta de la información.":"We are committed to protecting the security of your information. We implement appropriate technical and organizational measures to protect your data against unauthorized access, alteration, disclosure, or destruction. However, it is important to note that, while we take every possible precaution, we cannot guarantee that our servers are completely free from hacks or service interruptions. We acknowledge that no security measure is infallible, and therefore we cannot ensure absolute protection of information.",
      "5. Cambios en los Términos y Condiciones":"5. Changes to the Terms and Conditions",
      "Backup Reader LLC se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación en el sitio web. Es responsabilidad del usuario revisar regularmente esta sección para estar informado de cualquier cambio.":"Backup Reader LLC reserves the right to modify these Terms and Conditions at any time. Changes take effect immediately upon posting on the website. It is the user's responsibility to review this section regularly to stay informed of any changes.",
      "6. Contacto":"6. Contact",
      "Si tiene preguntas o comentarios sobre estos Términos y Condiciones, por favor contáctenos en info@backupreader.com.":"If you have questions or comments about these Terms and Conditions, please contact us at info@backupreader.com.",
      "7. Ley Aplicable y Jurisdicción":"7. Governing Law and Jurisdiction",
      "Estos Términos y Condiciones se regirán e interpretarán de acuerdo con las leyes del Estado de Florida, Estados Unidos, sin dar efecto a ningún principio de conflictos de ley. Cualquier disputa relacionada con estos términos será sometida a la jurisdicción exclusiva de los tribunales de ese estado.":"These Terms and Conditions shall be governed by and construed in accordance with the laws of the State of Florida, United States, without giving effect to any principles of conflicts of law. Any dispute related to these terms shall be subject to the exclusive jurisdiction of the courts of that state.",
      "8. Política de Privacidad":"8. Privacy Policy",
      "Por favor, consulte nuestra Política de Privacidad para entender cómo recopilamos, usamos y protegemos su información personal.":"Please refer to our Privacy Policy to understand how we collect, use, and protect your personal information.",
      "9. Derechos de Autor y Propiedad Intelectual":"9. Copyright and Intellectual Property",
      "Todo el contenido publicado en BackupReader.com, incluyendo textos, gráficos, logos, y software, es propiedad de Backup Reader LLC o se utiliza con permiso. Los usuarios deben respetar los derechos de autor y propiedad intelectual al utilizar el sitio.":"All content published on BackupReader.com, including text, graphics, logos, and software, is the property of Backup Reader LLC or is used with permission. Users must respect copyright and intellectual property rights when using the site.",
      "10. Limitación de Responsabilidad":"10. Limitation of Liability",
      "Backup Reader LLC no será responsable por daños directos, indirectos, incidentales, especiales o consecuentes que resulten del uso o la incapacidad de uso de nuestro servicio.":"Backup Reader LLC shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use our service.",
      "11. Uso de Servicios de Terceros":"11. Use of Third-Party Services",
      "Stripe:":"Stripe:",
      "Para procesar pagos, utilizamos Stripe. Al realizar pagos a través de nuestro sitio, usted acepta los términos de servicio de Stripe y reconoce que Backup Reader LLC no es responsable de las operaciones y seguridad de Stripe.":"To process payments, we use Stripe. By making payments through our site, you accept Stripe's terms of service and acknowledge that Backup Reader LLC is not responsible for Stripe's operations and security.",
      "Olark:":"Olark:",
      "Utilizamos Olark para proporcionar soporte en vivo y chat. Al interactuar con nuestro soporte a través de Olark, usted está sujeto a los términos y políticas de privacidad de Olark.":"We use Olark to provide live support and chat. By interacting with our support through Olark, you are subject to Olark's terms and privacy policies.",
      "YouTube:":"YouTube:",
      "Nuestro sitio puede incluir contenido integrado de YouTube. Al visualizar estos contenidos, usted acepta estar sujeto a los términos de servicio de YouTube.":"Our site may include embedded YouTube content. By viewing this content, you agree to be bound by YouTube's terms of service.",
      "Beneficios del respaldo de información":"Benefits of backing up your information",
      "Hoy, queremos resaltar la importancia de realizar copias de seguridad de tus datos con tiempo para garantizar la seguridad, privacidad y mantener tus recuerdos a salvo. Aquí te presentamos tres motivos convincentes para que tomes acción y protejas tus valiosos activos digitales:":"Today, we want to highlight the importance of backing up your data in time to ensure security, privacy, and keep your memories safe. Here are three compelling reasons for you to take action and protect your valuable digital assets:",
      "Seguridad frente a amenazas digitales":"Security against digital threats",
      "Vivimos en una era en la que el ciberespacio está lleno de amenazas, como virus, ransomware y hackers maliciosos. Estos ataques pueden dañar o eliminar por completo tus archivos, dejándote con una sensación devastadora de pérdida. Al realizar copias de seguridad periódicas, te aseguras de que, incluso si sufres un ataque, puedas recuperar tus datos sin problemas.":"We live in an era where cyberspace is full of threats, such as viruses, ransomware, and malicious hackers. These attacks can damage or completely delete your files, leaving you with a devastating sense of loss. By making regular backups, you ensure that, even if you suffer an attack, you can recover your data without problems.",
      "Privacidad y control":"Privacy and control",
      "Tu información personal es valiosa y delicada. Sin un respaldo adecuado, te expones al riesgo de pérdida de datos o de que tu información se vea comprometida. Al hacer copias de seguridad en dispositivos físicos externos o en servicios de almacenamiento en la nube con medidas de seguridad sólidas, mantienes el control total sobre tus datos y preservas tu privacidad.":"Your personal information is valuable and sensitive. Without a proper backup, you expose yourself to the risk of data loss or of your information being compromised. By backing up to external physical devices or to cloud storage services with strong security measures, you keep full control over your data and preserve your privacy.",
      "Preservación de recuerdos y documentos importantes":"Preservation of memories and important documents",
      "¿Cuántos recuerdos preciados atesoras en tus dispositivos? Fotografías de momentos especiales, videos familiares, cartas significativas, todos estos objetos digitales cuentan una parte única de tu historia. Hacer copias de seguridad garantiza que estos recuerdos estén protegidos y que puedas revivirlos en el futuro. No esperes a que sea demasiado tarde. La prevención es clave. Toma acción ahora y establece un plan de respaldo para tus dispositivos. Programa copias de seguridad periódicas y considera utilizar varias formas de almacenamiento para una protección adicional.":"How many precious memories do you treasure on your devices? Photos of special moments, family videos, meaningful letters, all these digital objects tell a unique part of your story. Backing up ensures that these memories are protected and that you can relive them in the future. Don't wait until it's too late. Prevention is key. Take action now and set up a backup plan for your devices. Schedule regular backups and consider using several forms of storage for extra protection.",
      "Respalda tus recuerdos":"Back up your memories",
      "Crea una cuenta en Backup Reader y empieza a respaldar tus conversaciones.":"Create an account on Backup Reader and start backing up your conversations.",
      "Empezar ahora":"Start now",
      "Ver publicación":"View post",
      "A pagar hoy":"Due today",
      "{{cantidad}} de descuento, mientras tengas la suscripción":"{{cantidad}} off, for as long as you stay subscribed",
      "{{cantidad}} de descuento, solo en el primer mes":"{{cantidad}} off, first month only",
      "{{cantidad}} de descuento, durante los primeros {{meses}} meses":"{{cantidad}} off for the first {{meses}} months",
      "{{cantidad}} de descuento":"{{cantidad}} off",
      "Código de descuento":"Discount code",
      "Si tienes uno":"If you have one",
      "Aplicar":"Apply",
      "Comprobando…":"Checking…",
      "Quitar":"Remove",
      "Descuento":"Discount",
      "Gratis":"Free",
      "No hay un plan seleccionado.":"No plan selected.",
      "Elige un plan":"Choose a plan",
      "Hoy no se te cobra nada. Guardamos tu tarjeta para cuando el descuento termine, y puedes cancelar antes.":"You are not charged anything today. We keep your card for when the discount ends, and you can cancel before then.",
      "No pudimos comprobar el código ahora mismo. Inténtalo de nuevo.":"We could not check the code right now. Please try again.",
      "Ese código ya no se puede usar. Prueba sin él.":"That code can no longer be used. Try without it.",
      "Ese código no existe o ya no está activo.":"That code does not exist or is no longer active.",
      "Ese código ya venció.":"That code has expired.",
      "Ese código ya se usó el máximo de veces.":"That code has been used the maximum number of times.",
      "Ese código no se puede usar con esta moneda.":"That code cannot be used with this currency.",
      "Ese código no aplica ningún descuento.":"That code does not apply any discount.",
      "Ese código no tiene un descuento asociado.":"That code has no discount attached.",
      "Escribe un código.":"Enter a code.",
      "Este código es solo para la primera compra. Si ya pagaste antes con este correo, no se aplicará.":"This code is for first purchases only. If you have paid before with this email, it will not apply.",
      "Acceso de solo lectura a tu propia cuenta":"Read-only access to your own account",
      "Advertencia":"Warning",
      "Al respaldar en la nube, puedes borrar chats de tu teléfono sin miedo a perder información importante.":"By backing up to the cloud, you can delete chats from your phone without fear of losing important information.",
      "Cambiar plan":"Change plan",
      "Cancela cuando quieras":"Cancel at any time",
      "Cancelar":"Cancel",
      "Características":"Features",
      "Cargando planes...":"Loading plans...",
      "Cargar más":"Load more",
      "Cargar más mensajes":"Load more messages",
      "Como aparece en la tarjeta":"As printed on the card",
      "Conecta tu cuenta de X y Backup Reader analiza tus propias publicaciones con inteligencia artificial, señalando lo que probablemente ya no te representa. Tú lo ves primero, nadie más, y tú decides qué hacer.":"Connect your X account and Backup Reader analyzes your own posts with artificial intelligence, flagging the things that probably don't represent you anymore. You see it first, nobody else, and you decide what to do.",
      "Conectar X":"Connect X",
      "Contraseña":"Password",
      "Conversaciones de hasta":"Conversations up to",
      "Correo":"Email",
      "Correo electrónico":"Email",
      "Cómo funciona el análisis":"How the analysis works",
      "De 6 a 8 caracteres":"6 to 8 characters",
      "Descubre qué dice tu historial de X sobre ti hoy":"See what your X history says about you today",
      "Elige un backup de la lista, o sube una nueva exportación de chat para leerla aquí.":"Pick a backup from the list, or upload a new chat export to read it here.",
      "Fecha de vencimiento":"Expiry date",
      "Guarda los chats de una misma persona las veces que quieras, ordenados por fecha.":"Save the chats of the same person as many times as you want, organized by date.",
      "Guardado":"Backed up",
      "Hallazgos clasificados como correcto, a revisar o requiere atención":"Findings graded as clear, worth reviewing, or needs attention",
      "La facturación empieza hoy. Cancela desde tu cuenta cuando quieras; tus backups siguen siendo legibles hasta que termine el periodo.":"Billing starts today. Cancel from your account whenever you want; your backups stay readable until the period ends.",
      "Las contraseñas no coinciden":"Passwords do not match",
      "Lee tus chats sin conexión, cuando quieras":"Read your chats offline, any time",
      "Los pagos se procesan por nuestro proveedor de pago. Nunca guardamos los datos de tu tarjeta.":"Payments are processed by our payment provider. We never store your card details.",
      "MB cada una":"MB each",
      "Mostrar":"Show",
      "Ningún chat seleccionado":"No chat selected",
      "No se borra nada por ti; tú mantienes el control":"Nothing is deleted for you; you stay in control",
      "Nombre":"Name",
      "Nombre en la tarjeta":"Name on card",
      "Nuevo · Backup Reader X":"New · Backup Reader X",
      "Número de tarjeta":"Card number",
      "Obteniendo mensajes del backup...":"Getting messages from the backup...",
      "Ocultar":"Hide",
      "Pago no realizado, por favor verifica los datos ingresados.":"Payment not completed, please check the details you entered.",
      "Plan":"Plan",
      "Puedes cancelar tu suscripción en cualquier momento":"You can cancel your subscription at any time",
      "Regístrate con Google":"Sign up with Google",
      "Repetir contraseña":"Repeat password",
      "Repite tu contraseña":"Repeat your password",
      "Resumen del pedido":"Order summary",
      "Selecciona tu Plan":"Select your plan",
      "Sin chats aún":"No chats yet",
      "tucorreo@email.com":"youremail@email.com",
      "tucorreo@ejemplo.com":"youremail@example.com",
      "Sin contratos ni penalizaciones. Detén tu suscripción desde tu cuenta cuando lo decidas.":"No contracts and no penalties. Stop your subscription from your account whenever you decide.",
      "Suscribirme":"Subscribe",
      "Suscribirte":"Subscribe",
      "Tu contraseña":"Your password",
      "Tu información siempre será tuya":"Your information will always be yours",
      "Tu nombre":"Your name",
      "Tutorial":"Tutorial",
      "Tú decides qué guardar y qué borrar. Elimina tu cuenta y todo lo que contiene se va contigo.":"You decide what to store and what to delete. Remove your account and everything in it goes with you.",
      "Volver al inicio":"Back to home",
      "al mes":"per month",
      "mes":"month",
      "suscripción mensual":"monthly subscription",
      "y":"and",
      "¿No tienes cuenta?":"Don't have an account?",
      "¿Ya tienes una?":"Already have one?",
      "Nuevo":"New",
      "Envía un correo a info@backupreader.com con la dirección de correo con la que te registraste, eliminaremos toda tu información y la suscripción.":"Send an email to info@backupreader.com with the email address you used to register, and we will delete all your information and the subscription.",
      "¿Cómo elimino mi cuenta?":"How do I delete my account?",
      "Guía Rápida para Crear tu Backup de WhatsApp":"Steps to Backup Your WhatsApp Chat",
      "Tienes":"You have",
      "días de prueba gratuitos":"days of free trial",
      "Archivos":"Files",
      "Subir desde:":"Upload from:",
      "Subiendo chat":"Uploading chat",
      "Escribe tu nombre.":"Enter your name.",
      "Escribe un correo válido.":"Enter a valid email address.",
      "La contraseña debe tener al menos 6 caracteres.":"Your password must be at least 6 characters.",
      "Las contraseñas no coinciden.":"The passwords don't match.",
      "Escribe tu contraseña.":"Enter your password.",
      "Mínimo 6 caracteres":"At least 6 characters",

      // --- Cifrado / bóveda (Etapas 5-8) ---------------------------------
      // Toda esta parte se escribió sin pasar por aquí, así que en inglés la
      // bóveda entera se quedaba en español.
      "Protege tus chats":"Protect your chats",
      "Elige una contraseña de cifrado. Con ella, tus chats se cifran en tu navegador antes de subirse: nadie más puede leerlos, ni siquiera nosotros.":"Choose an encryption password. With it, your chats are encrypted in your browser before they're uploaded: nobody else can read them, not even us.",
      "Importante: esta contraseña no se puede recuperar. Si la pierdes junto con el código de recuperación, tus chats quedan inaccesibles para siempre.":"Important: this password cannot be recovered. If you lose it along with your recovery code, your chats will be inaccessible forever.",
      "Contraseña de cifrado":"Encryption password",
      "Repite la contraseña":"Repeat the password",
      "Las dos contraseñas no coinciden.":"The two passwords don't match.",
      "No se pudo crear la protección. Inténtalo de nuevo.":"Encryption couldn't be set up. Please try again.",
      "Crear":"Create",
      "Ahora no":"Not now",
      "Activar cifrado":"Turn on encryption",
      "Aún no has activado el cifrado. Actívalo para que tus próximos chats se cifren en tu navegador antes de subirse.":"You haven't turned on encryption yet. Turn it on so your next chats are encrypted in your browser before they're uploaded.",
      "Tus chats cifrados están bloqueados. Introduce tu contraseña para verlos.":"Your encrypted chats are locked. Enter your password to see them.",
      "Desbloquear":"Unlock",
      "Desbloquea tus chats":"Unlock your chats",
      "Introduce tu contraseña de cifrado para ver tus chats.":"Enter your encryption password to see your chats.",
      "Introduce tu código de recuperación.":"Enter your recovery code.",
      "La contraseña no es correcta.":"That password isn't correct.",
      "El código de recuperación no es correcto.":"That recovery code isn't correct.",
      "He olvidado la contraseña":"I forgot my password",
      "Usar la contraseña":"Use my password",
      "Guarda tu código de recuperación":"Save your recovery code",
      "Este código es la única forma de recuperar tus chats si olvidas la contraseña. No volverá a mostrarse.":"This code is the only way to recover your chats if you forget your password. It won't be shown again.",
      "He guardado el código en un lugar seguro":"I've saved the code somewhere safe",
      "Código de recuperación":"Recovery code",
      "Generar código nuevo":"Generate a new code",
      "Generar uno nuevo invalida el anterior. Requiere la bóveda desbloqueada.":"Generating a new one invalidates the previous code. Your vault must be unlocked.",
      "No se pudo generar un código nuevo. Desbloquea la bóveda e inténtalo otra vez.":"A new code couldn't be generated. Unlock your vault and try again.",
      "Copiar":"Copy",
      "Copiado":"Copied",
      "Descargar":"Download",
      "Cifrado":"Encryption",
      "Todavía no has activado el cifrado de tus chats.":"You haven't turned on encryption for your chats yet.",
      "La bóveda está desbloqueada en esta sesión.":"Your vault is unlocked in this session.",
      "La bóveda está bloqueada en esta sesión.":"Your vault is locked in this session.",
      "Bloquear ahora":"Lock now",
      "Cambiar contraseña":"Change password",
      "Cambiar la contraseña de cifrado":"Change your encryption password",
      "Contraseña actual":"Current password",
      "Nueva contraseña":"New password",
      "Repite la nueva contraseña":"Repeat the new password",
      "La contraseña actual no es correcta.":"Your current password isn't correct.",
      "Contraseña actualizada.":"Password updated.",
      "Sin cifrar · Cifrar":"Unencrypted · Encrypt",
      "Desbloquea para cifrar":"Unlock to encrypt",
      "¿Qué estás buscando?":"What are you looking for?",
      "{{total}} guardados":"{{total}} saved",
      "Archivo .zip":".zip file",
      "Personas o mensajes":"People or messages",
      "Busca en tus {{total}} chats":"Search your {{total}} chats",
      "Todo":"All",
      "Personas":"People",
      "Personas · {{n}}":"People · {{n}}",
      "Mensajes · {{n}}":"Messages · {{n}}",
      "Abrir chat":"Open chat",
      "Abriendo…":"Opening…",
      "{{total}} coincidencias":"{{total}} matches",
      "Más de {{total}} coincidencias":"More than {{total}} matches",
      "Ver {{n}} más":"See {{n}} more",
      "Tu respaldo":"Your backup",
      "Tus chats, en un solo lugar.":"Your chats, all in one place.",
      "Léelos con calma. Solo tú tienes acceso.":"Read them at your own pace. Only you have access.",
      "Ver mis chats":"See my chats",
      "{{total}} chats guardados":"{{total}} chats saved",
      "Subir un chat":"Upload a chat",
      "Archivo .zip exportado de WhatsApp":"A .zip exported from WhatsApp",
      "Aún no tienes chats guardados.":"You don't have any saved chats yet.",
      "En WhatsApp, abre el chat → Más → Exportar chat. Luego súbelo aquí.":"In WhatsApp, open the chat → More → Export chat. Then upload it here.",
      "Desde Google Drive o Archivos · .zip":"From Google Drive or Files · .zip",
      "Recientes":"Recent",
      "Elige dónde está el .zip que exportaste.":"Choose where the .zip you exported is.",
      "Archivos del teléfono":"Files on this phone",
      "Si lo guardaste en tu Drive":"If you saved it to your Drive",
      "Si lo descargaste a este dispositivo":"If you downloaded it to this device",
      "Solo tú puedes ver tus chats":"Only you can see your chats",
      "Buscar en todos los chats":"Search all chats",
      "¿Eliminar el chat con {{nombre}}?":"Delete the chat with {{nombre}}?",
      "Borraremos sus mensajes, fotos, videos y audios de BackupReader.":"We'll delete its messages, photos, videos and audio from BackupReader.",
      "Esta acción no se puede deshacer.":"This can't be undone.",
      "Para recuperarlo tendrías que volver a subir el .zip.":"To get it back you'd have to upload the .zip again.",
      "Tu chat en WhatsApp no cambia":"Your WhatsApp chat is unchanged",
      "Eliminar chat":"Delete chat",
      "Eliminando…":"Deleting…",
      "Chat eliminado":"Chat deleted",
      "Tu clave está lista. Ya puedes subir chats.":"Your password is ready. You can upload chats now.",
      "Sube tu primer chat":"Upload your first chat",
      "Primero expórtalo desde WhatsApp. Toma menos de un minuto.":"First export it from WhatsApp. It takes under a minute.",
      "Abre el chat en WhatsApp.":"Open the chat in WhatsApp.",
      "Toca el nombre → Exportar chat → Adjuntar archivos.":"Tap the name → Export chat → Attach files.",
      "Guárdalo en Archivos o Google Drive.":"Save it to Files or Google Drive.",
      "Archivo .zip · Google Drive o Archivos":".zip file · Google Drive or Files",
      "Tu plan está activo":"Your plan is active",
      "Te enviamos el recibo a {{correo}}.":"We sent the receipt to {{correo}}.",
      "Te enviamos el recibo por correo.":"We sent the receipt by email.",
      "Próximo cobro":"Next charge",
      "Último paso: crea la clave con la que ciframos tus chats.":"Last step: create the password we encrypt your chats with.",
      "Crear clave de cifrado":"Create encryption password",
      "1 coincidencia":"1 match",
      "Política de privacidad":"Privacy Policy",
      "Activa el cifrado para poder subir chats":"Turn on encryption to upload chats",
      "Hasta que elijas tu contraseña de cifrado no se pueden subir chats, porque se cifran en tu navegador antes de salir de tu dispositivo.":"Until you choose your encryption password, chats can't be uploaded: they're encrypted in your browser before leaving your device.",
      "Tus chats cifrados están bloqueados y tampoco puedes subir nuevos. Introduce tu contraseña de cifrado para seguir.":"Your encrypted chats are locked and you can't upload new ones. Enter your encryption password to continue.",
      "Algo salió mal":"Something went wrong",
      "Algo falló durante la subida. Suele ser la conexión. Vuelve a intentarlo.":"Something failed during the upload. It's usually the connection. Try again.",
      "Entendido":"Got it",
      "Falta activar el cifrado":"Encryption isn't set up yet",
      "Tus chats se cifran en tu navegador antes de subirse, así que primero tienes que elegir una contraseña de cifrado. Sin ella no hay con qué cifrarlos y la subida no puede empezar.":"Your chats are encrypted in your browser before being uploaded, so you need to choose an encryption password first. Without it there's nothing to encrypt them with and the upload can't start.",
      "Tus chats están bloqueados":"Your chats are locked",
      "Tus chats están bloqueados. Desbloquéalos con tu contraseña de cifrado para poder leerlos.":"Your chats are locked. Unlock them with your encryption password to read them.",
      "Introduce tu contraseña de cifrado para desbloquearlos. Hasta entonces no se pueden leer ni subir nuevos.":"Enter your encryption password to unlock them. Until then they can't be read and new ones can't be uploaded.",
      "No se pudo cifrar el chat":"The chat couldn't be encrypted",
      "No se pudo subir el chat":"The chat couldn't be uploaded",
      "La copia cifrada no se completó, así que el chat original sigue donde estaba.":"The encrypted copy didn't finish, so the original chat is still where it was.",
      "Revisa tu conexión y recarga la página.":"Check your connection and reload the page.",
      "Revisa tu conexión y vuelve a intentarlo.":"Check your connection and try again.",
      "Clave de cifrado":"Encryption password",
      "Confirma tu clave":"Confirm your password",
      "Escríbela otra vez":"Type it again",
      "Así confirmamos que la recuerdas bien.":"This confirms you remember it.",
      "Con ella ciframos tus chats en tu teléfono antes de guardarlos.":"We use it to encrypt your chats on your phone before saving them.",
      "Si la olvidas, no podremos abrir tus chats. Guárdala en un lugar seguro.":"If you forget it, we won't be able to open your chats. Keep it somewhere safe.",
      "Entiendo que, si pierdo esta clave, mis chats no se pueden recuperar.":"I understand that if I lose this password, my chats can't be recovered.",
      "Marca la casilla para continuar.":"Tick the box to continue.",
      "Las claves coinciden":"The passwords match",
      "Las claves no coinciden":"The passwords don't match",
      "La clave debe tener al menos {{n}} caracteres.":"The password must be at least {{n}} characters.",
      "Guardar clave":"Save password",
      "Atrás":"Back",
      "Paso {{n}} de 3":"Step {{n}} of 3",
      "Mínimo {{n}} caracteres":"At least {{n}} characters",
      "Simple · añade otra palabra":"Simple · add another word",
      "Buena":"Good",
      "Excelente":"Excellent",
      "O con tu correo":"Or with your email",
      "Escribe tu correo y te enviamos un enlace para crear una nueva.":"Enter your email and we'll send you a link to create a new one.",
      "¿Entraste con Apple o Google? No tienes contraseña aquí; vuelve y usa ese botón.":"Did you sign in with Apple or Google? You don't have a password here; go back and use that button.",
      "Enviar enlace":"Send link",
      "Revisa tu correo":"Check your email",
      "Si {{correo}} tiene una cuenta, te llegará un enlace en unos minutos. Vence en una hora.":"If {{correo}} has an account, a link will arrive in a few minutes. It expires in one hour.",
      "Reenviar en {{reloj}}":"Resend in {{reloj}}",
      "Reenviar enlace":"Resend link",
      "Volver a entrar":"Back to sign in",
      "Cuenta creada":"Account created",
      "Paso":"Step",
      "de":"of",
      "Te faltan tres pasos.":"Three steps to go.",
      "Elige tu plan":"Choose your plan",
      "Cancela cuando quieras.":"Cancel anytime.",
      "Crea tu clave de cifrado":"Create your encryption password",
      "Solo tú la conoces.":"Only you know it.",
      "Confírmala":"Confirm it",
      "Para asegurarnos de que la recuerdas.":"To make sure you remember it.",
      "Activa tu plan":"Activate your plan",
      "Cancela cuando quieras, sin trámites.":"Cancel anytime, no paperwork.",
      "Guarda tus chats. Léelos cuando quieras.":"Keep your chats. Read them whenever you want.",
      "Revisa fotos, textos y audios de cada conversación.":"Browse photos, text and audio from every conversation.",
      "Continuar con Apple":"Continue with Apple",
      "Continuar con Google":"Continue with Google",
      "Continuar con correo":"Continue with email",
      "O":"Or",
      "Paso 1 de 2":"Step 1 of 2",
      "Paso 2 de 2":"Step 2 of 2",
      "Tu correo":"Your email",
      "Crea tu cuenta":"Create your account",
      "Escribe tu contraseña":"Enter your password",
      "Es tu primera vez con {{correo}}.":"This is your first time with {{correo}}.",
      "Cambiar":"Change",
      "Mínimo 8 caracteres":"At least 8 characters",
      "Toca el ojo para verla. No hace falta repetirla.":"Tap the eye to see it. No need to repeat it.",
      "Entrar":"Sign in",
      "Al continuar aceptas la":"By continuing you accept the",
      "y los":"and the",
      "Términos":"Terms",
      "Ese código de recuperación no vale. Revísalo e inténtalo de nuevo.":"That recovery code isn't valid. Check it and try again.",
      "Usar mi contraseña":"Use my password",
      "Es el código que guardaste al crear tu contraseña de cifrado.":"It's the code you saved when you created your encryption password.",
      "Chat cifrado":"Encrypted chat",
      "Bloqueado":"Locked",
      "Tus chats están bloqueados.":"Your chats are locked.",
      "Salir":"Exit",
      "Tus chats están cifrados con una contraseña que solo tú conoces. La necesitamos para abrirlos y para subir nuevos.":"Your chats are encrypted with a password only you know. We need it to open them and to upload new ones.",
      "Es distinta a la de tu cuenta de Apple o Google.":"It's different from your Apple or Google account password.",
      "Esa contraseña no abre tus chats. Inténtalo de nuevo.":"That password doesn't open your chats. Try again.",
      "Olvidé mi contraseña de cifrado":"I forgot my encryption password",
      "Ver contraseña":"Show password",
      "Ocultar contraseña":"Hide password",
      "Buscar en este chat":"Search this chat",
      "Resultado anterior":"Previous result",
      "Resultado siguiente":"Next result",
      "Sin resultados":"No results",
      "{{actual}} de {{total}} resultados":"{{actual}} of {{total}} results",
      "Mensajes":"Messages",
      "Media":"Media",
      "En otros chats":"In other chats",
      "Buscando…":"Searching…",
      "Sin coincidencias en otros chats.":"No matches in other chats.",
      "Preparando la búsqueda: faltan {{faltan}} de {{total}} chats.":"Getting search ready: {{faltan}} of {{total}} chats to go.",
      "Esta búsqueda no cubre {{faltan}} chat(s) todavía.":"This search doesn't cover {{faltan}} chat(s) yet.",
      "{{total}} mensaje(s)":"{{total}} message(s)",
      "Más de {{total}} mensaje(s)":"More than {{total}} message(s)",
      "Contacto: {{quien}}":"Contact: {{quien}}",
      "Borrar chat":"Delete chat",
      "Borrar este chat":"Delete this chat",
      "Borrar":"Delete",
      "Borrando…":"Deleting…",
      "Se borran del servidor los mensajes y todos los archivos de este chat. No se puede deshacer: como están cifrados con tu clave, ni siquiera nosotros podemos recuperarlos.":"This deletes the messages and every file in this chat from the server. It can't be undone: they're encrypted with your key, so not even we can recover them.",
      "La copia que tengas en tu teléfono o en tu computadora no se toca.":"Any copy on your phone or computer is left untouched.",
      "Quedaron {{cantidad}} archivo(s) sin borrar. El chat sigue en la lista: vuelve a intentarlo.":"{{cantidad}} file(s) could not be deleted. The chat is still listed: try again.",
      "Los archivos se borraron, pero el chat sigue en la lista. Vuelve a intentarlo para quitarlo.":"The files were deleted, but the chat is still listed. Try again to remove it.",
      "Ya hay un borrado en curso. Espera a que termine.":"A deletion is already running. Wait for it to finish.",
      "No se reconoce este chat.":"This chat isn't recognized.",
      "Tu sesión se cerró. Vuelve a entrar.":"Your session ended. Sign in again.",
      "No se pudo borrar el chat. Inténtalo de nuevo.":"The chat couldn't be deleted. Try again.",
      "¿Cifrar y borrar el original?":"Encrypt and delete the original?",
      "Este chat está guardado sin cifrar. Al cifrarlo, el original se borra del servidor.":"This chat is stored unencrypted. Once it's encrypted, the original is deleted from the server.",
      "Leyendo…":"Reading…",
      "Cifrando":"Encrypting",
      "Cifrando…":"Encrypting…",
      "Verificando…":"Verifying…",
      "Limpiando…":"Cleaning up…",

      // --- Sueltas que nunca tuvieron traducción --------------------------
      "Chats":"Chats",
      "Mi cuenta":"My account",
      "Continuar":"Continue",
      "Google Drive":"Google Drive",

      // --- Errores de registro (AuthContext) ------------------------------
      "Ese correo ya tiene una cuenta. Prueba a iniciar sesión.":"That email already has an account. Try signing in.",
      "El correo no tiene un formato válido.":"That email address isn't valid.",
      "La contraseña es demasiado débil. Usa al menos 6 caracteres.":"That password is too weak. Use at least 6 characters.",
      "El registro con correo y contraseña está desactivado. Avísanos para habilitarlo.":"Signing up with email and password is turned off. Let us know so we can enable it.",
      "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.":"Couldn't connect. Check your connection and try again.",
      "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.":"Too many attempts. Wait a few minutes and try again.",
      "No ha sido posible crear la cuenta. Inténtalo de nuevo en un momento.":"The account couldn't be created. Please try again in a moment.",
      "Aviso":"Notice",
      "El correo o la contraseña no son correctos.":"That email or password isn't correct.",

      // --- Suscripción (Mi cuenta) ----------------------------------------
      "Suscripción":"Subscription",
      "No tienes una suscripción activa.":"You don't have an active subscription.",
      "Ver planes":"See plans",
      "Tienes un plan activo.":"You have an active plan.",
      "Se renueva cada mes. Puedes cancelar cuando quieras.":"It renews monthly. You can cancel whenever you want.",
      "Cancelar suscripción":"Cancel subscription",
      "Sí, cancelar":"Yes, cancel",
      "Reactivar suscripción":"Resume subscription",
      "Cancelada. Mantienes el acceso hasta el":"Cancelled. You keep access until",
      "Tu suscripción terminó el":"Your subscription ended on",
      "Dejaremos de cobrarte, y mantendrás el acceso hasta el final del periodo que ya pagaste. Tus chats no se borran.":"We'll stop charging you, and you'll keep access until the end of the period you've already paid for. Your chats aren't deleted.",
      "Suscripción cancelada. No se te volverá a cobrar.":"Subscription cancelled. You won't be charged again.",
      "Suscripción reactivada.":"Subscription resumed.",
      "No se pudo completar la operación. Inténtalo de nuevo.":"That didn't go through. Please try again.",
      "No encontramos una suscripción activa en Stripe para tu correo. Escríbenos a info@backupreader.com y lo revisamos.":"We couldn't find an active Stripe subscription for your email. Write to us at info@backupreader.com and we'll look into it.",
      "Tu sesión ha caducado. Vuelve a iniciar sesión.":"Your session has expired. Please sign in again.",

      // --- Restablecer la contraseña de cifrado ---------------------------
      "He olvidado mi contraseña de cifrado":"I forgot my encryption password",
      "Restablecer con el código de recuperación":"Reset it with your recovery code",
      "Introduce el código que guardaste al activar el cifrado y elige una contraseña nueva. Tus chats no se vuelven a cifrar: siguen intactos.":"Enter the code you saved when you turned on encryption and choose a new password. Your chats aren't re-encrypted: they stay as they are.",
      "Al restablecerla se te dará un código de recuperación nuevo y el anterior dejará de servir.":"You'll get a new recovery code, and the old one will stop working.",
      "Restablecer contraseña":"Reset password",
      "Contraseña restablecida. Guarda tu código nuevo.":"Password reset. Save your new code.",
      "La nueva contraseña debe tener al menos 10 caracteres.":"Your new password must be at least 10 characters.",
      "Se está cifrando en tu navegador antes de subirse. No cierres esta pestaña.":"It's being encrypted in your browser before upload. Don't close this tab.",
      "Extrayendo chat":"Extracting chat",
      "Texto, fotos, videos, audios y links":"Messages, photos, videos, audios, and links",
      "Evita los dolores de cabeza que puede llegar a ser el recuperar viejas fotos, videos o información importante.":"Avoid the headaches that can come with recovering old photos, videos, or important information.",
      "Free space on your phone":"Libera espacio en tu teléfono",
      "Al realizar copias de seguridad en la nube, puedes eliminar chats de tu teléfono de forma segura, sin preocuparte por perder información importante.":"By backing up to the cloud, you can safely delete chats from your phone without worrying about losing important information.",
      "Guarda las veces que quieras los chats de una misma persona, así los podrás tener ordenados por fecha.":"Save the chats of the same person as many times as you want, so you can keep them organized by date.",
      "Iniciar con Google":"Sign in with Google",
      "Al continuar estarás aceptando nuestra":"By continuing, you will be accepting our",
      "Acceso a Datos de Google Drive":"Access to Google Drive Data",
      "Backup Reader requiere acceso a su Google Drive para cargar y procesar sus archivos de respaldo de redes sociales. Utilizamos la API de Google Drive para habilitar esta funcionalidad. Los usuarios otorgan permiso autorizando a Backup Reader a través de la pantalla de consentimiento de Google OAuth 2.0, donde pueden revisar y aprobar los tipos específicos de datos (por ejemplo, fotos, videos, documentos) a los que Backup Reader accederá.":"Backup Reader requires access to your Google Drive to upload and process your social media backup files. We use the Google Drive API to enable this functionality. Users grant permission by authorizing Backup Reader through the Google OAuth 2.0 consent screen, where they can review and approve the specific types of data (e.g., photos, videos, documents) that Backup Reader will access.",
      "Uso de Datos de Google Drive":"Use of Google Drive Data",
      "Backup Reader utilizará el acceso a sus datos de Google Drive únicamente con el propósito de cargar, almacenar y procesar sus archivos de respaldo de redes sociales. Específicamente, haremos lo siguiente:":"Backup Reader will use the access to your Google Drive data solely for the purpose of uploading, storing, and processing your social media backup files. Specifically, we will:",
      "Acceder y Leer Archivos: Acceder y leer archivos que usted seleccione explícitamente y otorgue permiso en su Google Drive.":"Access and Read Files: Access and read files that you explicitly select and grant permission for in your Google Drive.",
      "Almacenamiento de Archivos: Almacenar temporalmente los archivos seleccionados en nuestros servidores seguros para procesarlos.":"Store Files: Store the selected files temporarily on our secure servers to process them.",
      "Procesamiento de Archivos: Analizar y procesar los archivos almacenados para presentar los datos en un formato fácilmente legible dentro de la aplicación Backup Reader.":"Process Files: Parse and process the stored files to present the data in an easily readable format within the Backup Reader application.",
      "Almacenamiento de Datos de Google Drive":"Storage of Google Drive Data",
      "Backup Reader almacena tus archivos de respaldo de redes sociales subidos en nuestros servidores seguros durante el tiempo necesario para procesar y presentar los datos. Una vez completado el procesamiento, los archivos se eliminan de nuestros servidores. Nos aseguramos de que tus datos se almacenen de forma segura y no sean accesibles para personal no autorizado.":"Backup Reader stores your uploaded social media backup files on our secure servers for the duration necessary to process and present the data. Once the processing is complete, the files are deleted from our servers. We ensure that your data is stored securely and is not accessible to unauthorized personnel.",
      "Consentimiento del Usuario":"User Consent",
      "Al utilizar Backup Reader, consientes el acceso, uso, almacenamiento y compartición de tus datos de Google Drive según se describe en esta política de privacidad.":"By using Backup Reader, you consent to the access, use, storage, and sharing of your Google Drive data as described in this privacy policy.",
      "¿Qué ocurre si WhatsApp se cae o te roban el teléfono?":"What happens if WhatsApp goes down or you lose your phone?",
      "No pierdas tus recuerdos. Con nuestro servicio, puedes guardar mensajes, fotos, videos, documentos y enlaces de cualquier chat o grupo, liberando espacio en tu teléfono y manteniendo tus chats fácilmente accesibles incluso si WhatsApp no está disponible.":"Don't lose your memories. With our service, you can save messages, photos, videos, documents, and links from any chat or group, freeing up space on your phone and keeping your chats easily accessible even if WhatsApp is not available.",
      "Comienza ahora":"Start now",
      "Respalda fotos, audios, videos, documentos y chats":"Back up photos, audios, videos, documents, and chats",
      "Con nuestro servicio de almacenamiento en la nube, respalda tus fotos, audios, videos, documentos y chats de manera segura y conveniente. No deberás preocuparte por perder tus momentos más preciados. Almacenamos tus archivos de forma segura en la nube, garantizando que tus recuerdos estén protegidos contra cualquier pérdida accidental.":"With our cloud storage service, securely and conveniently back up your photos, audios, videos, documents, and chats. You won't have to worry about losing your most precious moments. We store your files safely in the cloud, ensuring that your memories are protected against any accidental loss.",
      "Libera espacio en tu teléfono":"Free up space on your phone",
      "Hacer backup de tus chats en la nube no solo promueve la seguridad de tus datos, sino que también te ayuda a liberar espacio valioso en tu teléfono. Al realizar copias de seguridad en la nube, puedes eliminar chats de tu teléfono de forma segura, sin preocuparte por perder información importante.":"Backing up your chats to the cloud not only enhances the security of your data but also helps you free up valuable space on your phone. By making cloud backups, you can safely delete chats from your phone without worrying about losing important information.",
      "Múltiples Versiones":"Multiple Versions",
      "El backup de chats en la nube ofrece la ventaja de conservar múltiples versiones de tus interacciones con una misma persona. Al tener la capacidad de guardar estos chats cuantas veces desees, puedes mantener un archivo histórico ordenado por fecha.":"Cloud chat backups offer the advantage of preserving multiple versions of your interactions with the same person. With the ability to save these chats as many times as you want, you can maintain a historical archive organized by date.",
      "Lee chats sin estar en línea":"Read chats offline",
      "Backup Reader te permite mantener una copia segura y accesible de tus mensajes, fotos, videos, audios y documentos, completamente independiente de los servidores de WhatsApp. Esto asegura que tu información permanezca disponible incluso cuando WhatsApp esté fuera de servicio o no lo estés utilizando.":"Backup Reader allows you to keep a secure and accessible copy of your messages, photos, videos, audios, and documents, completely independent of WhatsApp's servers. This ensures that your information remains available even when WhatsApp is down or you are not using it.",
      "Respalda fotos, videos y audios":"Back up photos, videos, and audios",
      "Libera espacio subiendo tus fotos a cloud":"Free up space by uploading your photos to the cloud",
      "Multiples versiones de un chat":"Multiple versions of a chat",
      "Preguntas frecuentes":"Frequently Asked Questions",
      "¿Qué es Backup Reader?":"What is Backup Reader?",
      "Backup Reader es un servicio en línea que te permite leer, extraer y almacenar de manera segura chats de WhatsApp en la nube manteniendo un orden cronológico y, sobre todo, manteniendo el acceso a los audios, imágenes y links dentro de la misma copia del chat.":"Backup Reader is an online service that allows you to read, extract, and securely store WhatsApp chats in the cloud, maintaining chronological order and, most importantly, preserving access to audios, images, and links within the same chat backup.",
      "¿Cuál es la diferencia entre Backup Reader y otros servicios de almacenamiento en la nube?":"What is the difference between Backup Reader and other cloud storage services?",
      "Backup Reader está diseñado específicamente para backups de redes sociales, por lo que vas a poder leer tus chats como si estuvieras utilizando la red social normalmente, permitiéndote acceder a todo el contenido de los chats, como fotos, audios, videos, etc. Además, no necesitas hacer backup de todos los chats, puedes seleccionar solo aquellos que te importen más. Un beneficio adicional es que al diversificar el almacenamiento de tus recuerdos, estos se vuelven menos vulnerables, ya que no están concentrados en un solo lugar, aumentando así la seguridad y la disponibilidad de tu información.":"Backup Reader is specifically designed for social media backups, allowing you to read your chats as if you were using the social network normally. You can access all the chat content, such as photos, audios, videos, etc. Additionally, you don't need to back up all your chats; you can select only those that matter most to you. An added benefit is that by diversifying the storage of your memories, they become less vulnerable since they are not concentrated in one place, thereby increasing the security and availability of your information.",
      "¿Qué sucede si elimino WhatsApp?":"What happens if I delete WhatsApp?",
      "Tus chats estarán seguros en Backup Reader, por lo que puedes acceder a tus chats en cualquier momento.":"Your chats will be safe in Backup Reader, so you can access them at any time.",
      "Si elimino mi cuenta de Backup Reader, ¿se eliminan también chats?":"If I delete my Backup Reader account, are the chats deleted as well?",
      "Sí, toda tu información se elimina una vez que eliminas tu cuenta de Backup Reader.":"Yes, all your information is deleted once you delete your Backup Reader account.",
      "Primer paso - Exportar el chat desde WhatsApp":"Step 1 - Export the chat from WhatsApp",
      "1) Abre Whatsapp, 2) Presiona sobre el chat que quieres hacer backup, 3) Presiona sobre el nombre (en la parte de superior), 4) En la parte de abajo encontrarás la opción 'Exportar chat', 5) Selecciona 'Adjuntar archivos', 6) Selecciona en la parte inferior (Guardar en archivos)":"1) Open WhatsApp, 2) Press on the chat you want to back up, 3) Tap on the name (at the top), 4) At the bottom, you will find the option 'Export chat', 5) Select 'Attach media', 6) Choose 'Save to Files' at the bottom.",
      "Segundo paso - Sube tu backup":"Step 2 - Upload your backup",
      "1) Subir chat, 2) Seleccionar archivos, 3) Busca el chat que subimos en el paso 1, 4) Presiona sobre el chat, 5) Presiona 'Abrir' en la parte superior derecha, listo, ya tienes tu primer backup.":"1) Upload chat, 2) Select files, 3) Find the chat you uploaded in Step 1, 4) Press on the chat, 5) Press 'Open' at the top right, and you're done. You've made your first backup.",
      "Backup de tus recuerdos":"Backup your memories",
      "Crea una cuenta y empieza a respaldar tus chats de forma segura.":"Create an account and start backing up your chats securely.",
      "En dos sencillos pasos aprende a utilizar Backup Reader y haz tu primer backup.":"Learn to use Backup Reader and make your first backup in two simple steps.",
      "Sube tu backup":"Upload your backup",
      "Aprende cómo usar Backup Reader":"Learn how to use Backup Reader",
      "Términos del Servicio":"Terms of Service",
      "Controles de Acceso":"Access Controls",
      "Reglas de Seguridad de la Base de Datos: Nuestro sistema permite la definición de reglas de seguridad para controlar el acceso de lectura y escritura a la base de datos, asegurando que solo los usuarios autorizados puedan realizar estas acciones.":"Database Security Rules: Our system allows the definition of security rules to control read and write access to the database, ensuring that only authorized users can perform these actions.",
      "Gestión de Identidad y Acceso (IAM): Proporcionamos capacidades IAM listas para usar para gestionar el acceso a los recursos en la nube, asegurando que los usuarios tengan los permisos adecuados según sus roles.":"Identity and Access Management (IAM): We provide out-of-the-box IAM capabilities to manage access to cloud resources, ensuring that users have the appropriate permissions based on their roles.",
      "Respaldo Automático y periódico de información para recuperación de desastres.":"Automated and periodic backup of information for disaster recovery.",
      "Respaldo y Recuperación de Datos":"Data Backup and Recovery",
      "Cifrado de Datos":"Data Encryption",
      "En Reposo: Backup Reader proporciona cifrado en reposo de manera predeterminada.":"At Rest: Backup Reader provides encryption at rest by default.",
      "En Tránsito: TLS está habilitado de forma predeterminada para los datos transmitidos hacia y desde los servicios que utiliza Backup Reader.":"In Transit: TLS is enabled by default for data transmitted to and from the servers Backup Reader uses.",
      "Ayuda":"Help",
      "Subir Chat":"Upload Chat",
      "Política de Privacidad":"Privacy Policy",
      "Términos de Servicio":"Terms of Service",
      "¿Cómo hacerlo?":"Learn how to do it",
      "Subir Chat desde Google Drive":"Upload Chat from Google Drive",
      "Política de Privacidad de Backup Reader LLC para BackupReader.com": "Backup Reader LLC Privacy Policy for BackupReader.com",
      "Información que Recopilamos":"Information We Collect",
      "Uso de la Información":"Use of the Information",
      "Recopilamos información que los usuarios suben voluntariamente a nuestro sitio, incluyendo datos personales y contenidos. Además, utilizamos Google Analytics para recopilar datos anónimos sobre el comportamiento de los visitantes en nuestro sitio. Recopilamos información que los usuarios suben voluntariamente a nuestro sitio, incluyendo datos personales y contenidos. Además, utilizamos Google Analytics para recopilar datos anónimos sobre el comportamiento de los visitantes en nuestro sitio. También recopilamos datos de Google Drive como parte de nuestro servicio de respaldo de redes sociales, que incluye los archivos que los usuarios seleccionan y nos otorgan permiso para acceder, como fotos, videos y documentos.":"We collect information that users voluntarily upload to our site, including personal data and content. Additionally, we use Google Analytics to collect anonymous data about visitor behavior on our site. We also collect data from Google Drive as part of our social media backup service, which includes the files users select and grant permission for us to access, such as photos, videos, and documents.",
      "La información recopilada se utiliza para mejorar la experiencia del usuario en nuestro sitio, mantener y mejorar nuestros servicios, y para propósitos de comunicación interna. Específicamente, utilizamos los datos recopilados de Google Drive para cargar, almacenar y procesar archivos de respaldo de redes sociales para presentar los datos en un formato fácilmente legible dentro de la aplicación Backup Reader.":"The information collected is used to improve the user experience on our site, maintain and improve our services, and for internal communication purposes. Specifically, we use the data collected from Google Drive to upload, store, and process social media backup files to present the data in an easily readable format within the Backup Reader application.",
      "Compartir y Divulgar Información":"Share and Disclose Information",
      "No compartimos los datos de los usuarios de Google con terceros, excepto cuando sea necesario para proporcionar nuestros servicios, cumplir con la ley o proteger nuestros derechos.":"We do not sell or share your personal information with third parties, except as necessary to provide our services (for example, payment processing through Stripe), comply with the law, or protect our rights. We do not share Google user data with third parties, except as necessary to provide our services, comply with the law, or protect our rights.",
      "Servicios de Terceros":"Third Party Services",
      "Utilizamos servicios de terceros como Stripe para procesamiento de pagos, Olark para soporte en vivo y YouTube para contenido integrado. Estos servicios operan bajo sus propios términos y políticas de privacidad.":"We use third-party services such as Stripe for payment processing, Olark for live support, and YouTube for embedded content. These services operate under their own terms and privacy policies.",
      "Seguridad de la Información":"Information Security",
      "Nos comprometemos a proteger la seguridad de su información. Sin embargo, no podemos garantizar la seguridad absoluta de nuestros servidores y contra ataques cibernéticos o interrupciones del servicio.":"We are committed to protecting the security of your information. However, we cannot guarantee the absolute security of our servers and against cyberattacks or service interruptions.",
      "Acceso y Control de su Información":"Access and Control of Your Information",
      "Los usuarios pueden acceder, corregir o eliminar su información personal contactándonos en info@backupreader.com. Además, pueden solicitar la eliminación de su cuenta y toda información asociada.":"Users can access, correct, or delete their personal information by contacting us at info@backupreader.com. Additionally, they may request the deletion of their account and all associated information.",
      "Requisitos de Edad":"Age Requirements",
      "Cambios en la Política de Privacidad":"Changes to the Privacy Policy",
      "Los servicios de BackupReader.com están destinados a usuarios que son mayores de edad según la legislación de su país de residencia. Los menores de edad deben obtener el consentimiento de sus padres o tutores legales antes de usar nuestro servicio.":"The services of BackupReader.com are intended for users who are of legal age according to the legislation of their country of residence. Minors must obtain the consent of their parents or legal guardians before using our service.",
      "Nos reservamos el derecho de modificar esta Política de Privacidad. Cualquier cambio será comunicado a través de nuestro sitio web y entrará en vigor inmediatamente después de su publicación.":"We reserve the right to modify this Privacy Policy. Any changes will be communicated through our website and will take effect immediately after their publication.",
      "Contacto":"Contact",
      "Si tiene preguntas sobre esta Política de Privacidad, por favor contáctenos en info@backupreader.com.":"If you have questions about this Privacy Policy, please contact us at info@backupreader.com.",
      "Fecha de Última Actualización: 11 de Mayo de 2024":"Last Updated Date: May 11, 2024",
      "Fecha de Última Actualización: 14 de Mayo de 2024":"Last Updated Date: May 14, 2024",
      "Fecha de Última Actualización: 27 de Junio de 2024":"Last Updated Date: Jun 27, 2024",
      "Backup Reader usará y transferirá a cualquier otra aplicación la información recibida de las":"Backup Reader use and transfer to any other app of information received from",
      "APIs de Google":"Google APIs",
      "de acuerdo con la":"will adhere to",
      "Política de Datos de Usuario de los Servicios de API de Google":"Google API Services User Data Policy",
      ", incluidos los requisitos de Uso Limitado.":", including the Limited Use requirements.",
      "Cerrar sesión": "Logout",

      // --- Panel de chats y separadores de día -----------------------------
      "Tus chats · {{n}}": "Your chats · {{n}}",
      "Agregar chat": "Add a chat",
      "Desde Archivos": "From Files",
      "Desde Google Drive": "From Google Drive",
      "Cerrar": "Close",
      "Hoy": "Today",
      "Ayer": "Yesterday",

      // --- Entrada, clave de cifrado y recuperación (rondas 4 y 5) ---------
      "Tus chats, enteros": "Your chats, whole",
      "Fotos, audios y videos tal como los enviaste, no solo el texto.":
        "Photos, audio and video just as you sent them, not only the text.",
      "Sitio libre en el teléfono": "Free space on your phone",
      "Guarda la conversación aquí y bórrala del móvil sin perderla.":
        "Keep the conversation here and delete it from your phone without losing it.",
      "Cifrado con una clave que solo tú conoces":
        "Encrypted with a key only you know",
      "Ni nosotros podemos leer lo que subes.": "Not even we can read what you upload.",
      "Tus chats están aquí, cerrados. Escribe tu contraseña de cifrado para leerlos.":
        "Your chats are here, locked. Enter your encryption password to read them.",
      "Desbloquea para buscar": "Unlock to search",
      "Guarda tu código de recuperación": "Save your recovery code",
      "Es lo único que abre tus chats si olvidas la clave. Solo se enseña ahora.":
        "It is the only thing that opens your chats if you forget your key. It is shown only now.",
      "Copiar código": "Copy code",
      "Lo he guardado en un lugar seguro.": "I have saved it somewhere safe.",
      "Entrar a mis chats": "Go to my chats",
      "Volver a escribirla": "Type it again",
      "Guardando…": "Saving…",
      "Abrir app de correo": "Open mail app",
      "Hola de nuevo": "Welcome back",
      "Mencionado en {{chat}}": "Mentioned in {{chat}}",
      "Atajos": "Shortcuts",
      "Siguiente resultado": "Next result",
      "Abrir en el chat": "Open in chat",
      "Cerrar búsqueda": "Close search",
      "Arrastra un .zip aquí o elige desde Google Drive o Archivos.":
        "Drag a .zip here, or pick it from Google Drive or Files.",
      "Sube otro chat": "Upload another chat",
      "Suelta el archivo para subirlo": "Drop the file to upload it",
      "Plan activo": "Plan active",
      "Ahora, tu clave.": "Now, your key.",
      "Solo tú la conoces.": "Only you know it.",
      "Confírmala": "Confirm it",
      "Para asegurarnos de que la recuerdas.": "So we know you remember it.",
      "Guarda tu código": "Save your code",
      "Por si olvidas la clave.": "In case you forget your key.",
      "Tus chats están cifrados en este dispositivo.":
        "Your chats are encrypted on this device.",
      "Pago seguro con tarjeta.": "Secure payment by card.",
      "Foto del chat": "Chat photo",
      "Conversaciones": "Conversations",
      "Idioma": "Language",
      "Menú": "Menu",
      "Ya tengo cuenta · Entrar": "I already have an account · Sign in",

      // --- Ayuda: animaciones y preguntas frecuentes ----------------------
      "Cifrado": "Encryption",
      "Tus chats, bajo dos llaves": "Your chats, under two keys",
      "Se cifran en tu dispositivo antes de salir de él. Ni nosotros podemos abrirlos: la clave no sale de tu lado.":
        "They're encrypted on your device before they leave it. Not even we can open them: the key never leaves your side.",
      "Animación: cómo se cifran tus chats con dos llaves":
        "Animation: how your chats are encrypted with two keys",
      "Preguntas": "Questions",
      "Lo que suele preguntarse antes de subir el primer chat":
        "What people usually ask before uploading their first chat",
      "¿Te queda alguna duda? Escríbenos a info@backupreader.com y te contestamos.":
        "Still unsure about something? Write to info@backupreader.com and we'll answer.",
      "XChaCha20-Poly1305 · Argon2id · cifrado en tu dispositivo":
        "XChaCha20-Poly1305 · Argon2id · encrypted on your device",

      "¿Qué tipo de cifrado se usa?": "What kind of encryption do you use?",
      "Tus mensajes y tus archivos se cifran con XChaCha20-Poly1305, en bloques de 64 KB. No es AES-256, que es lo que suele nombrarse: es un algoritmo de la misma generación y la misma solidez, y la razón de elegirlo es que va más rápido en el navegador, que es donde se cifra todo aquí.":
        "Your messages and files are encrypted with XChaCha20-Poly1305, in 64 KB blocks. It isn't AES-256, which is the one usually named: it's an algorithm of the same generation and the same strength, and the reason for choosing it is that it runs faster in the browser, which is where everything is encrypted here.",
      "Tu contraseña de cifrado no se usa directamente para cifrar. Pasa primero por Argon2id, con 64 MB de memoria y tres pasadas, que es lo que convierte una contraseña en una clave y hace que probarlas a la fuerza salga carísimo. Con esa clave se envuelve otra clave, aleatoria, que es la que cifra de verdad tus chats.":
        "Your encryption password isn't used to encrypt directly. It first goes through Argon2id, with 64 MB of memory and three passes, which is what turns a password into a key and makes guessing them by brute force extremely expensive. That key then wraps another, random key, which is the one that actually encrypts your chats.",
      "Ese rodeo es lo que permite que tu código de recuperación funcione sin guardar tu contraseña en ningún sitio: la misma clave aleatoria va envuelta dos veces, una con tu contraseña y otra con el código.":
        "That detour is what lets your recovery code work without storing your password anywhere: the same random key is wrapped twice, once with your password and once with the code.",

      "¿Puede el equipo de BackupReader leer mis chats?":
        "Can the BackupReader team read my chats?",
      "No. El cifrado ocurre en tu teléfono o en tu ordenador, antes de que nada salga de ahí. Lo que llega a nuestros servidores son archivos cifrados y un índice cifrado; tu contraseña no se envía nunca, ni siquiera transformada. Sin ella no hay forma de abrir nada, y nosotros no la tenemos.":
        "No. The encryption happens on your phone or your computer, before anything leaves it. What reaches our servers are encrypted files and an encrypted index; your password is never sent, not even transformed. Without it there's no way to open anything, and we don't have it.",
      "Hay una excepción honesta, y preferimos decirla: los chats que se subieron antes de que existiera el cifrado siguen guardados sin cifrar hasta que los cifres tú. La aplicación te los marca y te ofrece un botón para hacerlo. Mientras no lo pulses, esos chats concretos sí son legibles por quien tenga acceso al servidor.":
        "There's one honest exception, and we'd rather say it: chats uploaded before the encryption existed are still stored unencrypted until you encrypt them. The app marks them and offers you a button to do it. Until you press it, those particular chats are readable by anyone with access to the server.",

      "¿Qué pasa si olvido la contraseña y el código de recuperación?":
        "What if I forget both my password and my recovery code?",
      "Los chats se pierden. No es una política que podamos saltarnos haciendo una excepción: la clave que abre tus archivos solo existe dentro de dos envoltorios, uno que abre tu contraseña y otro que abre tu código. Si se pierden los dos, no queda nada en ninguna parte con lo que abrirlos, tampoco de nuestro lado.":
        "The chats are lost. It isn't a policy we could waive as a favour: the key that opens your files exists only inside two wrappers, one your password opens and one your code opens. If both are lost, there is nothing anywhere left to open them with, on our side either.",
      "Es el precio de que nadie más pueda leerlos. Un sistema donde soporte puede devolverte el acceso es un sistema donde soporte puede entrar. Por eso el código de recuperación se enseña una sola vez y te pedimos que confirmes que lo has guardado: guárdalo donde guardas las cosas que no puedes perder.":
        "It's the price of nobody else being able to read them. A system where support can give you back access is a system where support can get in. That's why the recovery code is shown only once and we ask you to confirm you've saved it: keep it where you keep the things you can't afford to lose.",

      "¿Dónde se guardan mis datos?": "Where is my data stored?",
      "En la infraestructura de Google Cloud, a través de Firebase: los archivos en Cloud Storage y los datos de la cuenta en Firestore. Los pagos los procesa Stripe, que recibe tu tarjeta y tu correo; nosotros no guardamos ningún número de tarjeta.":
        "On Google Cloud's infrastructure, through Firebase: the files in Cloud Storage and your account data in Firestore. Payments are handled by Stripe, which receives your card and your email; we don't store any card number.",
      "Da igual en qué país esté el servidor para lo que de verdad importa: lo que hay en él está cifrado con una clave que no sale de tu dispositivo. Una orden judicial, una filtración o un empleado curioso se encontrarían con archivos que no se pueden abrir.":
        "Which country the server sits in doesn't change what matters most: what's on it is encrypted with a key that never leaves your device. A court order, a leak or a curious employee would all find files that can't be opened.",

      "¿Cuánto almacenamiento incluye la suscripción?":
        "How much storage does the subscription include?",
      "Cada conversación puede ocupar hasta {{n}} MB.":
        "Each conversation can take up to {{n}} MB.",
      "Lo verás en la pantalla de planes, con el precio al lado.":
        "You'll see it on the plans screen, next to the price.",
      "Lo que ocupa cada conversación depende sobre todo de las fotos, los audios y los vídeos: un chat de solo texto, por largo que sea, apenas pesa.":
        "What each conversation takes up depends mostly on photos, audio and video: a text-only chat, however long, barely weighs anything.",

      "¿Puedo cancelar cuando quiera?": "Can I cancel whenever I want?",
      "Sí, desde «Mi cuenta», sin escribir a nadie ni dar explicaciones. La cancelación se aplica al final del periodo que ya has pagado: no se te vuelve a cobrar, y hasta esa fecha sigues entrando con normalidad. No devolvemos la parte del mes en curso porque no la cortamos: la sigues usando.":
        "Yes, from \"My account\", without writing to anyone or explaining yourself. The cancellation takes effect at the end of the period you've already paid for: you won't be charged again, and until that date you keep signing in as usual. We don't refund the current month because we don't cut it short: you keep using it.",
      "Si además quieres que borremos tu cuenta y todo lo que has subido, escríbenos a info@backupreader.com desde el correo con el que te registraste.":
        "If you also want us to delete your account and everything you've uploaded, write to info@backupreader.com from the address you signed up with.",

      // --- Enlaces de los correos de Firebase (5f) -------------------------
      "Comprobando el enlace…": "Checking the link…",
      "Este enlace no sirve": "This link doesn't work",
      "Este enlace está incompleto. Ábrelo desde el correo que te enviamos.":
        "This link is incomplete. Open it from the email we sent you.",
      "Este enlace ya no vale: se usó o pasó más de una hora desde que se envió. Pide uno nuevo.":
        "This link is no longer valid: it was used, or more than an hour has passed since it was sent. Ask for a new one.",
      "Pedir un enlace nuevo": "Ask for a new link",
      "Crea una contraseña nueva": "Create a new password",
      "Para {{correo}}": "For {{correo}}",
      "Contraseña nueva": "New password",
      "Esa contraseña es demasiado corta.": "That password is too short.",
      "Esto cambia la contraseña de acceso. Tu clave de cifrado sigue igual y la pediremos al entrar.":
        "This changes your sign-in password. Your encryption key stays the same, and we'll ask for it when you sign in.",
      "Guardar y entrar": "Save and sign in",
      "No se pudo guardar. Prueba con otra contraseña o pide un enlace nuevo.":
        "We couldn't save it. Try another password, or ask for a new link.",
      "Tu contraseña está lista": "Your password is ready",
      "Entra con tu contraseña nueva. Después te pediremos tu clave de cifrado para abrir tus chats.":
        "Sign in with your new password. We'll then ask for your encryption key to open your chats.",
      "Tu correo está verificado": "Your email is verified",
      "Ya puedes entrar con normalidad.": "You can sign in as usual now.",
      "Recuperaste tu correo": "You got your email back",
      "Tu cuenta vuelve a ser {{correo}}. Cambia tu contraseña si no reconoces este cambio.":
        "Your account is {{correo}} again. Change your password if you don't recognise this change.",
      "Cambia tu contraseña si no reconoces este cambio.":
        "Change your password if you don't recognise this change.",

      // --- Panel de administración ----------------------------------------
      "(sin correo)": "(no email)",
      "Administrador: no se borra desde aquí": "Administrator: not deleted from here",
      "Alta": "Signed up",
      "Último acceso": "Last seen",
      "Borrado a medio terminar": "Deletion half finished",
      "Borrar esta cuenta": "Delete this account",
      "Borrar para siempre": "Delete for good",
      "Buscar por correo, nombre o uid": "Search by email, name or uid",
      "Cobrado": "Charged",
      "Cobrado y NO devuelto": "Charged and NOT refunded",
      "Cuenta borrada": "Account deleted",
      "Cuenta de acceso borrada": "Sign-in account deleted",
      "Devoluciones: {{hechas}} hechas, {{fallidas}} fallidas":
        "Refunds: {{hechas}} done, {{fallidas}} failed",
      "Devolverle {{importe}} (opcional, y aparte del borrado)":
        "Refund them {{importe}} (optional, and separate from the deletion)",
      "El borrado falló": "The deletion failed",
      "Entra con": "Signs in with",
      "Escribe": "Type",
      "Espacio": "Space",
      "Esto no se puede deshacer. Los chats están cifrados con una clave que solo existe dentro de la bóveda de este usuario: al borrarla, los archivos quedan ilegibles para siempre, también para ti.":
        "This cannot be undone. The chats are encrypted with a key that exists only inside this user's vault: once it is deleted, the files are unreadable for good, for you too.",
      "Falta la cuenta de servicio en el servidor (FIREBASE_SERVICE_ACCOUNT_B64). Sin eso no se puede listar ni borrar.":
        "The service account is missing on the server (FIREBASE_SERVICE_ACCOUNT_B64). Without it nothing can be listed or deleted.",
      "Firestore: {{n}} metadatos de chats, bóveda, estado y perfil":
        "Firestore: {{n}} chat records, vault, status and profile",
      "Los cobros ya hechos siguen en Stripe: no se pueden borrar, son el registro contable de un dinero que se movió.":
        "Charges already made stay in Stripe: they cannot be deleted, they are the accounting record of money that moved.",
      "No se pudo cargar la lista de usuarios.": "We couldn't load the user list.",
      "No se pudo consultar Stripe. Puedes borrar igual, pero revisa a mano si tenía suscripción.":
        "Stripe couldn't be checked. You can delete anyway, but check by hand whether they had a subscription.",
      "Recargar": "Reload",
      "Sin bóveda creada": "No vault created",
      "Storage: {{n}} archivos borrados": "Storage: {{n}} files deleted",
      "Stripe: {{subs}} suscripción(es) cancelada(s), {{clientes}} cliente(s) borrado(s)":
        "Stripe: {{subs}} subscription(s) cancelled, {{clientes}} customer(s) deleted",
      "Suscripción": "Subscription",
      "devuelto": "refunded",
      "en": "in",
      "ninguna viva": "none live",
      "ninguno": "none",
      "para confirmar": "to confirm",
      "sin bóveda": "no vault",
      "sin cliente": "no customer",
      "{{n}} chat(s) · {{tam}} cifrados": "{{n}} chat(s) · {{tam}} encrypted",
      "{{n}} cliente(s)": "{{n}} customer(s)",
      "{{n}} cobro(s)": "{{n}} charge(s)",
      "Suscríbete": "Subscribe",

      // --- Avisos de error (AvisoDeErrores) --------------------------------
      "No se pudo cargar tu lista de chats": "We couldn't load your chat list",
      "No se pudo abrir el chat": "We couldn't open the chat",
      "Algo falló durante la subida. Suele ser la conexión. Vuelve a intentarlo; lo que se haya subido a medias no se mostrará ni ocupará sitio en tu lista.":
        "Something went wrong during the upload. It is usually the connection. Try again; anything half-uploaded won't show up or take space in your list.",
      "Introduce tu contraseña de cifrado para desbloquearlos. Hasta entonces no se pueden subir chats nuevos ni leer los que ya tienes cifrados.":
        "Enter your encryption password to unlock them. Until then you can't upload new chats or read the ones you already encrypted.",
      "La copia cifrada no se completó, así que el chat original sigue intacto y no se ha borrado nada. Puedes volver a intentarlo cuando quieras.":
        "The encrypted copy didn't finish, so the original chat is untouched and nothing was deleted. You can try again whenever you want.",
      "Esta contraseña es la de tu cuenta. Tus chats están cifrados con otra, que no cambia aquí.":
        "This is your account password. Your chats are encrypted with a different one, which does not change here.",
      "Tus chats siguen a salvo mientras recuperas el acceso.":
        "Your chats stay safe while you get back in.",
      "Suscribirme · ${{precio}}/mes": "Subscribe · ${{precio}}/mo",
      "Respalda tus chat de WhatsApp.":
        "Backup your Whatsapp Chats.",
      "Guarda y lee tus conversaciones de forma segura en la nube.":
        "Save and read your conversations securely in the cloud.",
      "Imagenes y Texto": "Photos and Text",
      "Revisa todas las fotos de una conversacion busca texto en las conversaciones, todo en la nube.":
        "Review all photos of a conversation search text in conversations, all in the cloud.",
      "Elimina conversaciones en tu celular de forma segura haciendo un Backup en la nube.":
        "Delete conversations on your cell phone safely by making a Backup in the cloud.",
      "Multiples Versiones": "Multiple Versions",
      "Guarda las veces que quieras las conversaciones de una misma persona, así podrás tenerlas ordenadas por fecha.":
        "Save as many times as you want the conversations of the same person, so you can have them ordered by date.",
      "¿Que es Backup Reader?": "What is a Backup Reader?",
      "Backup Reader es un servicio en línea que le permite leer, extraer y almacenar chats de WhatsApp en la nube de forma segura.":
        "Backup Reader is an online service that enables you to read, extract, and securely store chats from WhatsApp in the cloud.",
      "¿Que ocurre si elimino la app de Whatsapp?":
        "What happens if I delete Whatsapp?",
      "Si elimino mi cuenta de Backup Reader, ¿también se eliminan mis chats?":
        "If I delete my Backup Reader account, are my chats also deleted?",
      "¿Es seguro usar un Backup Reader?":
        "Is it safe to use a Backup Reader?",
      "Backup your memories": "Respalda tus recuerdos",
      "Crear cuenta": "Create Account",
      /* Había dos "Iniciar sesión" ("Or login" y "Login"). En un objeto gana
         la última, así que la primera no se usaba nunca; se quita la muerta. */
      "Continuar con email": "Continue with email",
      "Iniciar sesión": "Login",
      "Todas las opciones de inicio de sesión": "All login options",
      Continuar: "Continue",
      "¿Olvidaste tu contraseña?": "Forgot your password?",
      Registrarme: "Or create an account",
      /* Este duplicado decía "Sign up with Google" y, por ser el último,
         ganaba. Pero la clave solo se usa en la pantalla de ENTRAR, así que en
         inglés el login invitaba a registrarse. Se queda el de más arriba,
         "Sign in with Google". */
      "Sube un chat": "Upload a new chat",
      "Selecciona un chat": "Select a chat",
      "Subir chat": "Upload chat",
      Conversaciones: "Chats",
      "Solicitud enviada": "Request sent",
      "Esta conversacíon sera eliminada en breve":
        "This conversation will be deleted",
      Advertencia: "Notification",
      "¿Deseas eliminar esta conversación?":
        "Are you sure to delete this conversation?",
      Cancelar: "Cancel",
      "Información de pago": "Payment details",
      "Total a pagar": "Total amount",
      "Realizar pago": "Make Payment",
      "Selecciona tu plan": "Choose your plan",
      "Puedes cancelar tu plan en cualquier momento":
        "You can cancel at any time",
      "Ideal para guardar conversaciones individuales.":
        "Ideal for saving individual conversations.",
      "Acceso ilimitado desde cualquier dispositivo":
        "Unlimited access from any device",
      Mes: "Month",
      "Ideal para guardar conversaciones  un grupo y unos chats individuales.":
        "Ideal for saving group conversations and individual chats.",
      "Ideal para guardar conversaciones  de grupos y chats individuales.":
        "Ideal for saving group conversations and individual chats.",
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Idioma fijo al inicializar: servidor y cliente pintan lo mismo, así no
    // hay desajuste de hidratación. La detección real se aplica después de
    // montar, desde _app.tsx.
    lng: "es",
    fallbackLng: "es",
    detection: {
      /* El detector SOLO mira lo que dice el navegador.
       *
       * Nada de `cookie` ni `localStorage` aquí, y `caches` vacío. Ese era el
       * fallo: con `lng: "es"` arriba, i18next escribía la cookie `i18next=es`
       * durante el init, ANTES de detectar nada. Después `detect()` se leía su
       * propia cookie y devolvía "es" la primera, así que un navegador en
       * inglés jamás ganaba. La app guardaba "es" como si el visitante lo
       * hubiera elegido.
       *
       * Lo que el visitante elige de verdad se guarda aparte, bajo `br_lang`,
       * y se consulta antes que esto. Así las dos señales no se pisan.
       *
       * `htmlTag` también fuera: leía el atributo `lang` del <html>, escrito a
       * mano, así que devolvía siempre lo mismo. No dice nada del visitante. */
      order: ["querystring", "navigator"],
      lookupQuerystring: "lng",
      caches: [],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

/* Nombre propio, a propósito. Los que usa i18next por defecto —`i18next` en
   cookie, `i18nextLng` en localStorage— pueden traer valores que escribió el
   propio i18next, no el visitante, y esos no se pueden distinguir de una
   elección real. Con una clave nuestra, lo que haya ahí lo pusimos nosotros
   porque alguien pulsó el botón. */
const CLAVE_IDIOMA = "br_lang";
const IDIOMAS = ["es", "en"];

/** "en-US" -> "en". Lo que se guarda y se compara es siempre el código base. */
const base = (valor) => String(valor || "").split("-")[0].toLowerCase();

/** Uno de los que existen, o null. Evita acabar en un idioma sin traducciones. */
const soportado = (valor) => (IDIOMAS.includes(base(valor)) ? base(valor) : null);

/**
 * Qué idioma eligió el visitante, si es que eligió.
 *
 * Se lee a mano en vez de dejárselo al detector porque hay que distinguir dos
 * cosas que el detector mezcla: "este señor pulsó EN" y "su navegador está en
 * inglés". La primera manda siempre; la segunda solo sirve la primera vez.
 */
function idiomaGuardado() {
  if (typeof window === "undefined") return null;
  try {
    const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + CLAVE_IDIOMA + "=([^;]*)"));
    if (m) return soportado(decodeURIComponent(m[1]));
  } catch (e) {}
  try {
    return soportado(window.localStorage.getItem(CLAVE_IDIOMA));
  } catch (e) {
    return null;
  }
}

/**
 * Cambia el idioma y lo deja guardado.
 *
 * El guardado se hace aquí, explícitamente, y no se confía a que
 * `changeLanguage` llame al `cacheUserLanguage` del detector: ese
 * comportamiento depende de la versión de i18next y, si falla, el síntoma es
 * justo el que se veía —pulsas EN, recargas, y vuelve a español porque la
 * detección por navegador pisa tu elección—. Una cookie de un año, escrita a
 * mano, no depende de nada.
 */
export function cambiarIdioma(valor) {
  const idioma = soportado(valor) || "es";
  if (typeof window !== "undefined") {
    try {
      const unAno = 60 * 60 * 24 * 365;
      document.cookie = `${CLAVE_IDIOMA}=${idioma};path=/;max-age=${unAno};SameSite=Lax`;
      window.localStorage.setItem(CLAVE_IDIOMA, idioma);
    } catch (e) {}
    /* Que el <html lang> diga la verdad: lo leen los buscadores, los lectores
       de pantalla y el corrector del navegador. */
    document.documentElement.lang = idioma;
  }
  if (idioma !== i18n.language) i18n.changeLanguage(idioma);
  return idioma;
}

/**
 * Aplica el idioma al cargar. Solo tiene sentido en el navegador.
 *
 * Prioridad: lo que el visitante eligió > lo que dice su navegador > español.
 */
export function aplicarIdiomaDetectado() {
  if (typeof window === "undefined") return;

  const elegido = idiomaGuardado();
  if (elegido) {
    /* Ya eligió: se respeta y no se vuelve a detectar nada. */
    document.documentElement.lang = elegido;
    if (elegido !== i18n.language) i18n.changeLanguage(elegido);
    return;
  }

  /* Primera visita. `detect()` devuelve una lista en el orden configurado;
     se coge el primero que tenga traducciones, no el primero a secas, porque
     un "fr-FR" dejaría la interfaz en un idioma que no existe. */
  const detectado = i18n.services.languageDetector?.detect();
  const lista = Array.isArray(detectado) ? detectado : [detectado];
  const idioma = lista.map(soportado).find(Boolean) || "es";

  document.documentElement.lang = idioma;
  if (idioma !== i18n.language) i18n.changeLanguage(idioma);
}

export default i18n;
