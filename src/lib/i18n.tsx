import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { storage } from "./storage.ts";

const en = {
  "app.name": "Civic",
  "app.tagline": "Your personal voting plan and sample ballot",
  "app.skip": "Skip to main content",
  "lang.switch": "Español",
  "lang.switchLabel": "Ver en español",

  "nav.label": "Your voting information",
  "nav.plan": "Voting plan",
  "nav.ballot": "Sample ballot",
  "nav.sheet": "Cheat sheet",
  "nav.change": "Change address",

  "home.heading": "Know where, when and what you're voting on",
  "home.lead":
    "Enter your home address (where you're registered to vote) to get your polling place, early-voting and drop-off options, and your full ballot.",
  "home.privacy": "We don't store your address. Your ballot choices stay on this device.",
  "home.demo": "Try it with a test election",
  "home.demoHint": "Uses Google's sample data, not a real election.",
  "home.upcoming": "Elections with information available now",
  "home.noUpcoming": "No elections have published data right now. Data usually appears a few weeks before an election.",

  "form.label": "Home address",
  "form.placeholder": "e.g. 1600 Pennsylvania Ave NW, Washington, DC 20500",
  "form.hint": "Use the residential address where you're registered to vote, including city and state.",
  "form.submit": "Get my voting plan",
  "form.loading": "Looking up…",
  "form.invalid": "Enter your full street address, including city and state.",
  "form.suggestions": "Address suggestions",
  "form.suggestionsCount": "{n} suggestions available. Use up and down arrows to choose.",

  "status.loading": "Looking up your voting information…",

  "err.title": "Something went wrong",
  "err.address_not_found":
    "We couldn't find that address. Check the street, city and state, and use the residential address where you're registered.",
  "err.bad_request": "Enter your full street address, including city and state.",
  "err.rate_limited": "Too many lookups in a short time. Please wait a minute and try again.",
  "err.upstream_error": "The election data service isn't responding right now. Please try again in a moment.",
  "err.not_configured": "This site isn't fully set up yet (missing API key). Please try again later.",
  "err.network": "We couldn't reach the server. Check your connection and try again.",
  "err.retry": "Try again",

  "empty.title": "No election information for this address yet",
  "empty.body":
    "Polling places and ballots appear only as an election gets close. There may be no election scheduled for your address right now, or your state or county hasn't published its information yet.",
  "empty.officeLinks": "Check with your election office",
  "empty.voteGov": "Find your state election office on vote.gov (official U.S. government site)",
  "empty.otherElections": "This address has information for another election:",

  "picker.label": "Election",
  "picker.help": "More than one election has information for this address. Choose one to see its details.",
  "picker.show": "Show this election",

  "plan.heading": "Your voting plan",
  "plan.area": "For an address in {area}",
  "plan.daysLeft": "{n} days until Election Day",
  "plan.today": "Election Day is today",
  "plan.tomorrow": "Election Day is tomorrow",
  "plan.past": "This election date has passed",
  "plan.mailOnly.title": "Your precinct votes by mail",
  "plan.mailOnly.body":
    "Your ballot should arrive by mail. Return it by mail or at a drop-off location below. If it doesn't arrive, contact your election office.",
  "plan.polling.title": "Where to vote on Election Day",
  "plan.polling.many": "You can vote at any of these vote centers. Nearest first.",
  "plan.polling.none": "No Election Day polling place is listed yet. Check with your local election office.",
  "plan.early.title": "Early voting",
  "plan.early.lead": "Vote in person before Election Day.",
  "plan.early.none": "No early-voting sites are listed for this address.",
  "plan.dropoff.title": "Drop off your mail ballot",
  "plan.dropoff.lead": "Return a completed mail ballot at any of these locations.",
  "plan.dropoff.none": "No ballot drop-off locations are listed for this address.",
  "plan.showMore": "Show {n} more",
  "plan.showLess": "Show fewer",
  "plan.truncated": "Showing the {shown} nearest of {total} locations.",
  "plan.map": "Map of voting locations",
  "plan.mapYou": "Your address (approximate)",
  "plan.checklist.title": "Before you vote",
  "plan.checklist.registration": "Check that your registration is current",
  "plan.checklist.where": "Know where and when you'll vote",
  "plan.checklist.ballot": "Review your sample ballot and mark your choices",
  "plan.checklist.id": "Check your state's voter ID rules",

  "loc.hours": "Hours",
  "loc.dates": "Dates",
  "loc.notes": "Notes",
  "loc.services": "Services",
  "loc.directions": "Directions",
  "loc.miles": "{n} mi",
  "loc.unnamed": "Voting location",

  "cal.title": "Add key dates to your calendar",
  "cal.button": "Download calendar file (.ics)",
  "cal.electionDay": "Election Day",
  "cal.earlyStart": "Early voting starts",
  "cal.dropoffDeadline": "Last day to drop off your ballot",
  "cal.includes": "Includes:",

  "share.title": "Share this plan",
  "share.body": "The link includes the election, polling place and dates, but not your home address.",
  "share.copy": "Copy link",
  "share.copied": "Link copied",
  "share.native": "Share…",

  "office.title": "Election offices",
  "office.lead": "Official places to register, check your registration, and get help.",
  "office.state": "State",
  "office.local": "Local",
  "office.hours": "Hours",
  "office.address": "Address",
  "office.contact": "Contact",
  "office.link.info": "Election information",
  "office.link.registration": "Register to vote",
  "office.link.registrationCheck": "Check your registration",
  "office.link.absentee": "Absentee / mail voting",
  "office.link.locationFinder": "Official polling place finder",
  "office.link.ballotInfo": "Ballot information",
  "office.link.rules": "Voting rules",

  "source.official": "Official source",
  "source.unofficial": "Unofficial source",
  "source.label": "Source: {name}",
  "sources.title": "About this information",
  "sources.body":
    "This information comes from the Google Civic Information API, which collects it from state and local election officials. Coverage varies. Always confirm details with your election office.",
  "sources.list": "Sources used on this page:",

  "ballot.heading": "Your sample ballot",
  "ballot.lead":
    "Every race and measure listed for your address, in official ballot order. Civic does not endorse any candidate or position.",
  "ballot.none": "No races or measures are listed for this address yet.",
  "ballot.jump": "Jump to section",
  "ballot.voteFor": "Vote for {n}",
  "ballot.district": "District",
  "ballot.measure": "Ballot measure",
  "ballot.summary": "Summary",
  "ballot.pro": "Arguments in favor",
  "ballot.con": "Arguments against",
  "ballot.fullText": "Full text",
  "ballot.showFull": "Read the full text",
  "ballot.hideFull": "Hide the full text",
  "ballot.threshold": "Needed to pass",
  "ballot.abstain": "If you skip this",
  "ballot.moreInfo": "More information",
  "ballot.noCandidates": "No candidates listed.",
  "ballot.choose": "Mark your choice (optional)",
  "ballot.limit": "You can mark up to {n}.",
  "ballot.clear": "Clear",
  "ballot.clearAll": "Clear all choices",
  "ballot.confirmClear": "Clear all your marked choices for this election?",
  "ballot.saved": "Your choices are saved only in this browser. They are never sent to us.",
  "ballot.progress": "{n} of {total} marked",
  "ballot.noParty": "No party listed",
  "ballot.website": "Website",
  "ballot.email": "Email",
  "ballot.phone": "Phone",
  "ballot.photo": "Photo of {name}",
  "ballot.toSheet": "View cheat sheet",

  "level.federal": "Federal",
  "level.state": "State",
  "level.county": "County",
  "level.city": "City & local",
  "level.school": "School board & education",
  "level.judicial": "Judicial",
  "level.special": "Special districts",
  "level.other": "Other contests",

  "sheet.heading": "Your cheat sheet",
  "sheet.lead":
    "Take this with you to vote. Many states allow notes in the voting booth, but some don't allow phones. Check your state's rules.",
  "sheet.print": "Print",
  "sheet.image": "Save as image",
  "sheet.saving": "Saving…",
  "sheet.empty": "You haven't marked any choices yet.",
  "sheet.goBallot": "Go to your sample ballot",
  "sheet.notMarked": "Not marked",
  "sheet.where": "Where to vote",
  "sheet.when": "When",
  "sheet.generated": "Made with Civic. Nonpartisan; choices are your own.",

  "shared.heading": "Shared voting plan",
  "shared.warning":
    "Someone shared this plan with you. Polling places depend on each voter's address, so look up your own to be sure.",
  "shared.lookup": "Look up my own address",
  "shared.invalid": "This shared link is invalid or incomplete.",
  "shared.earlyNearest": "Nearest early-voting site",
  "shared.dropoffNearest": "Nearest drop-off location",

  "footer.nonpartisan": "Civic is nonpartisan. We don't endorse candidates, parties or positions.",
  "footer.data": "Election data: Google Civic Information API / Voting Information Project. Maps © OpenStreetMap contributors.",
  "footer.privacy": "Privacy: we don't store or log your address, and we don't use ad trackers.",
  "footer.report": "Report a problem",

  "nav.reps": "Representatives",
  "nav.repsShort": "Reps",

  "err.not_found": "We couldn't find that item.",
  "err.feature_disabled": "This feature isn't turned on for this site yet.",
  "err.summary_unavailable": "A summary isn't available right now.",

  "candidate.back": "Back to your sample ballot",
  "candidate.details": "see candidate details",
  "candidate.runningFor": "Running for",
  "candidate.mark": "Mark as my choice",
  "candidate.marked": "Marked as my choice",
  "candidate.contact": "Website and contact",
  "candidate.noContact": "No website or contact information was provided for this candidate.",
  "candidate.neutral":
    "Candidate details come from election officials and the candidates themselves. Civic doesn't edit, rank or endorse candidates.",
  "candidate.others": "Everyone running in this race",
  "candidate.ballotOrder": "In official ballot order.",
  "candidate.notFound": "We couldn't find that candidate. The ballot may have changed.",

  "ai.button": "Explain in plain language",
  "ai.loading": "Writing a summary…",
  "ai.hint": "AI-generated summary of the official text. It may contain mistakes.",
  "ai.badge": "AI",
  "ai.title": "Plain-language summary",
  "ai.disclaimer":
    "Written by AI from the official ballot text. It can make mistakes and is not official. Read the full official text below before you decide.",
  "ai.error": "We couldn't create a summary right now. The official text is below.",

  "remind.title": "Get reminders",
  "remind.lead": "We'll remind you when early voting starts, the day before Election Day, and on Election Day.",
  "remind.how": "How should we remind you?",
  "remind.email": "Email",
  "remind.sms": "Text message",
  "remind.emailLabel": "Email address",
  "remind.phoneLabel": "U.S. mobile number",
  "remind.consentEmail": "Yes, email me voting reminders for this election. I can unsubscribe with one tap.",
  "remind.consentSms":
    "Yes, text me up to 4 voting reminders for this election. Message and data rates may apply. Reply STOP to opt out.",
  "remind.needConsent": "Please check the box to agree to reminders.",
  "remind.submit": "Sign up for reminders",
  "remind.checkEmail": "Almost done! Check your email and tap the link to confirm.",
  "remind.checkPhone": "Almost done! Check your texts and tap the link to confirm.",
  "remind.badEmail": "Enter a valid email address.",
  "remind.badPhone": "Enter a valid U.S. mobile number.",
  "remind.privacy":
    "We store only your email or phone number, language, and this election's dates and polling place, never your home address. Everything is deleted after the election.",

  "reps.heading": "Who represents you",
  "reps.lead": "Your members of Congress and state legislators, based on your home address.",
  "reps.loading": "Looking up your representatives…",
  "reps.state": "State",
  "reps.cd": "Congressional district",
  "reps.upper": "State senate district",
  "reps.lower": "State house district",
  "reps.county": "County",
  "reps.federal": "U.S. Congress",
  "reps.stateLeg": "State legislature",
  "reps.stateFallback": "We can't list state legislators here yet. Use the official lookup:",
  "reps.findState": "Find your state legislators",
  "reps.none": "No one was found for this address.",
  "reps.contactForm": "Contact form",
  "reps.divisions": "All the districts this address is in",
  "reps.note":
    "Representatives are listed by office, with no ranking or endorsement. Districts can change after redistricting, so confirm with your state's official sources.",

  "report.heading": "Report a problem",
  "report.lead":
    "Spotted wrong or missing information, or something that doesn't work? Tell us. Please don't include your home address.",
  "report.kind": "What kind of problem?",
  "report.kind.wrong": "Wrong information",
  "report.kind.missing": "Missing information",
  "report.kind.bug": "Something doesn't work",
  "report.kind.accessibility": "Accessibility problem",
  "report.kind.other": "Something else",
  "report.message": "What happened?",
  "report.messageHint": "Include the election, race or location name if it helps.",
  "report.email": "Your email (optional, only if you'd like a reply)",
  "report.submit": "Send report",
  "report.thanks": "Thank you! We've received your report.",
  "report.error": "We couldn't send your report. Please try again.",
};

export type MessageKey = keyof typeof en;
type Dictionary = Record<MessageKey, string>;

const es: Dictionary = {
  "app.name": "Civic",
  "app.tagline": "Tu plan de votación personal y tu boleta de muestra",
  "app.skip": "Saltar al contenido principal",
  "lang.switch": "English",
  "lang.switchLabel": "View in English",

  "nav.label": "Tu información de votación",
  "nav.plan": "Plan de votación",
  "nav.ballot": "Boleta de muestra",
  "nav.sheet": "Hoja de apoyo",
  "nav.change": "Cambiar dirección",

  "home.heading": "Sepa dónde, cuándo y sobre qué va a votar",
  "home.lead":
    "Ingrese la dirección de su casa (donde está inscrito para votar) para ver su centro de votación, las opciones de votación anticipada y de entrega de boletas, y su boleta completa.",
  "home.privacy": "No guardamos su dirección. Sus selecciones se quedan en este dispositivo.",
  "home.demo": "Pruébelo con una elección de prueba",
  "home.demoHint": "Usa datos de muestra de Google, no una elección real.",
  "home.upcoming": "Elecciones con información disponible ahora",
  "home.noUpcoming":
    "Ninguna elección tiene datos publicados ahora. Los datos suelen aparecer unas semanas antes de una elección.",

  "form.label": "Dirección de su casa",
  "form.placeholder": "p. ej. 1600 Pennsylvania Ave NW, Washington, DC 20500",
  "form.hint": "Use la dirección residencial donde está inscrito para votar, con ciudad y estado.",
  "form.submit": "Ver mi plan de votación",
  "form.loading": "Buscando…",
  "form.invalid": "Ingrese su dirección completa, con ciudad y estado.",
  "form.suggestions": "Sugerencias de dirección",
  "form.suggestionsCount": "{n} sugerencias disponibles. Use las flechas arriba y abajo para elegir.",

  "status.loading": "Buscando su información de votación…",

  "err.title": "Algo salió mal",
  "err.address_not_found":
    "No encontramos esa dirección. Revise la calle, la ciudad y el estado, y use la dirección residencial donde está inscrito.",
  "err.bad_request": "Ingrese su dirección completa, con ciudad y estado.",
  "err.rate_limited": "Demasiadas búsquedas en poco tiempo. Espere un minuto e inténtelo de nuevo.",
  "err.upstream_error": "El servicio de datos electorales no responde en este momento. Inténtelo de nuevo en un momento.",
  "err.not_configured": "Este sitio aún no está configurado por completo (falta la clave de API). Inténtelo más tarde.",
  "err.network": "No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.",
  "err.retry": "Intentar de nuevo",

  "empty.title": "Aún no hay información electoral para esta dirección",
  "empty.body":
    "Los centros de votación y las boletas aparecen solo cuando se acerca una elección. Puede que no haya una elección programada para su dirección, o que su estado o condado aún no haya publicado la información.",
  "empty.officeLinks": "Consulte con su oficina electoral",
  "empty.voteGov": "Busque la oficina electoral de su estado en vote.gov (sitio oficial del gobierno de EE. UU.)",
  "empty.otherElections": "Esta dirección tiene información de otra elección:",

  "picker.label": "Elección",
  "picker.help": "Hay información de más de una elección para esta dirección. Elija una para ver sus detalles.",
  "picker.show": "Ver esta elección",

  "plan.heading": "Su plan de votación",
  "plan.area": "Para una dirección en {area}",
  "plan.daysLeft": "Faltan {n} días para el día de la elección",
  "plan.today": "Hoy es el día de la elección",
  "plan.tomorrow": "Mañana es el día de la elección",
  "plan.past": "La fecha de esta elección ya pasó",
  "plan.mailOnly.title": "Su precinto vota por correo",
  "plan.mailOnly.body":
    "Su boleta debería llegarle por correo. Devuélvala por correo o en uno de los lugares de entrega de abajo. Si no le llega, comuníquese con su oficina electoral.",
  "plan.polling.title": "Dónde votar el día de la elección",
  "plan.polling.many": "Puede votar en cualquiera de estos centros de votación. Primero los más cercanos.",
  "plan.polling.none":
    "Todavía no hay un centro de votación para el día de la elección. Consulte con su oficina electoral local.",
  "plan.early.title": "Votación anticipada",
  "plan.early.lead": "Vote en persona antes del día de la elección.",
  "plan.early.none": "No hay lugares de votación anticipada para esta dirección.",
  "plan.dropoff.title": "Entregue su boleta por correo",
  "plan.dropoff.lead": "Entregue su boleta completada en cualquiera de estos lugares.",
  "plan.dropoff.none": "No hay lugares de entrega de boletas para esta dirección.",
  "plan.showMore": "Mostrar {n} más",
  "plan.showLess": "Mostrar menos",
  "plan.truncated": "Se muestran los {shown} más cercanos de {total} lugares.",
  "plan.map": "Mapa de lugares de votación",
  "plan.mapYou": "Su dirección (aproximada)",
  "plan.checklist.title": "Antes de votar",
  "plan.checklist.registration": "Confirme que su inscripción esté al día",
  "plan.checklist.where": "Sepa dónde y cuándo votará",
  "plan.checklist.ballot": "Revise su boleta de muestra y marque sus selecciones",
  "plan.checklist.id": "Consulte las reglas de identificación de su estado",

  "loc.hours": "Horario",
  "loc.dates": "Fechas",
  "loc.notes": "Notas",
  "loc.services": "Servicios",
  "loc.directions": "Cómo llegar",
  "loc.miles": "{n} mi",
  "loc.unnamed": "Lugar de votación",

  "cal.title": "Agregue las fechas clave a su calendario",
  "cal.button": "Descargar archivo de calendario (.ics)",
  "cal.electionDay": "Día de la elección",
  "cal.earlyStart": "Comienza la votación anticipada",
  "cal.dropoffDeadline": "Último día para entregar su boleta",
  "cal.includes": "Incluye:",

  "share.title": "Compartir este plan",
  "share.body": "El enlace incluye la elección, el centro de votación y las fechas, pero no la dirección de su casa.",
  "share.copy": "Copiar enlace",
  "share.copied": "Enlace copiado",
  "share.native": "Compartir…",

  "office.title": "Oficinas electorales",
  "office.lead": "Sitios oficiales para inscribirse, revisar su inscripción y obtener ayuda.",
  "office.state": "Estatal",
  "office.local": "Local",
  "office.hours": "Horario",
  "office.address": "Dirección",
  "office.contact": "Contacto",
  "office.link.info": "Información electoral",
  "office.link.registration": "Inscribirse para votar",
  "office.link.registrationCheck": "Revisar su inscripción",
  "office.link.absentee": "Voto en ausencia / por correo",
  "office.link.locationFinder": "Buscador oficial de centros de votación",
  "office.link.ballotInfo": "Información sobre la boleta",
  "office.link.rules": "Reglas de votación",

  "source.official": "Fuente oficial",
  "source.unofficial": "Fuente no oficial",
  "source.label": "Fuente: {name}",
  "sources.title": "Sobre esta información",
  "sources.body":
    "Esta información proviene de la API de Información Cívica de Google, que la recopila de funcionarios electorales estatales y locales. La cobertura varía. Confirme siempre los detalles con su oficina electoral.",
  "sources.list": "Fuentes usadas en esta página:",

  "ballot.heading": "Su boleta de muestra",
  "ballot.lead":
    "Todas las contiendas y medidas para su dirección, en el orden oficial de la boleta. Civic no respalda a ningún candidato ni postura.",
  "ballot.none": "Todavía no hay contiendas ni medidas para esta dirección.",
  "ballot.jump": "Ir a la sección",
  "ballot.voteFor": "Vote por {n}",
  "ballot.district": "Distrito",
  "ballot.measure": "Medida electoral",
  "ballot.summary": "Resumen",
  "ballot.pro": "Argumentos a favor",
  "ballot.con": "Argumentos en contra",
  "ballot.fullText": "Texto completo",
  "ballot.showFull": "Leer el texto completo",
  "ballot.hideFull": "Ocultar el texto completo",
  "ballot.threshold": "Necesario para aprobarse",
  "ballot.abstain": "Si no vota en esta",
  "ballot.moreInfo": "Más información",
  "ballot.noCandidates": "No hay candidatos.",
  "ballot.choose": "Marque su selección (opcional)",
  "ballot.limit": "Puede marcar hasta {n}.",
  "ballot.clear": "Borrar",
  "ballot.clearAll": "Borrar todas las selecciones",
  "ballot.confirmClear": "¿Borrar todas sus selecciones para esta elección?",
  "ballot.saved": "Sus selecciones se guardan solo en este navegador. Nunca se nos envían.",
  "ballot.progress": "{n} de {total} marcadas",
  "ballot.noParty": "Sin partido indicado",
  "ballot.website": "Sitio web",
  "ballot.email": "Correo",
  "ballot.phone": "Teléfono",
  "ballot.photo": "Foto de {name}",
  "ballot.toSheet": "Ver hoja de apoyo",

  "level.federal": "Federal",
  "level.state": "Estatal",
  "level.county": "Condado",
  "level.city": "Ciudad y local",
  "level.school": "Junta escolar y educación",
  "level.judicial": "Judicial",
  "level.special": "Distritos especiales",
  "level.other": "Otras contiendas",

  "sheet.heading": "Su hoja de apoyo",
  "sheet.lead":
    "Llévela cuando vaya a votar. Muchos estados permiten notas en la cabina de votación, pero algunos no permiten teléfonos. Consulte las reglas de su estado.",
  "sheet.print": "Imprimir",
  "sheet.image": "Guardar como imagen",
  "sheet.saving": "Guardando…",
  "sheet.empty": "Todavía no ha marcado ninguna selección.",
  "sheet.goBallot": "Ir a su boleta de muestra",
  "sheet.notMarked": "Sin marcar",
  "sheet.where": "Dónde votar",
  "sheet.when": "Cuándo",
  "sheet.generated": "Hecho con Civic. No partidista; las selecciones son suyas.",

  "shared.heading": "Plan de votación compartido",
  "shared.warning":
    "Alguien compartió este plan con usted. Los centros de votación dependen de la dirección de cada votante, así que busque la suya para estar seguro.",
  "shared.lookup": "Buscar mi propia dirección",
  "shared.invalid": "Este enlace compartido no es válido o está incompleto.",
  "shared.earlyNearest": "Lugar de votación anticipada más cercano",
  "shared.dropoffNearest": "Lugar de entrega más cercano",

  "footer.nonpartisan": "Civic no es partidista. No respaldamos candidatos, partidos ni posturas.",
  "footer.data":
    "Datos electorales: API de Información Cívica de Google / Voting Information Project. Mapas © colaboradores de OpenStreetMap.",
  "footer.privacy": "Privacidad: no guardamos ni registramos su dirección, y no usamos rastreadores publicitarios.",
  "footer.report": "Reportar un problema",

  "nav.reps": "Representantes",
  "nav.repsShort": "Repres.",

  "err.not_found": "No encontramos ese elemento.",
  "err.feature_disabled": "Esta función aún no está activada en este sitio.",
  "err.summary_unavailable": "No hay un resumen disponible en este momento.",

  "candidate.back": "Volver a su boleta de muestra",
  "candidate.details": "ver detalles del candidato",
  "candidate.runningFor": "Candidato a",
  "candidate.mark": "Marcar como mi selección",
  "candidate.marked": "Marcado como mi selección",
  "candidate.contact": "Sitio web y contacto",
  "candidate.noContact": "No se proporcionó un sitio web ni datos de contacto para este candidato.",
  "candidate.neutral":
    "Los datos de los candidatos provienen de los funcionarios electorales y de los propios candidatos. Civic no edita, clasifica ni respalda candidatos.",
  "candidate.others": "Todos los candidatos en esta contienda",
  "candidate.ballotOrder": "En el orden oficial de la boleta.",
  "candidate.notFound": "No encontramos a ese candidato. Puede que la boleta haya cambiado.",

  "ai.button": "Explicar en lenguaje sencillo",
  "ai.loading": "Escribiendo un resumen…",
  "ai.hint": "Resumen del texto oficial generado por IA. Puede contener errores.",
  "ai.badge": "IA",
  "ai.title": "Resumen en lenguaje sencillo",
  "ai.disclaimer":
    "Escrito por IA a partir del texto oficial de la boleta. Puede tener errores y no es oficial. Lea el texto oficial completo abajo antes de decidir.",
  "ai.error": "No pudimos crear un resumen ahora. El texto oficial está abajo.",

  "remind.title": "Reciba recordatorios",
  "remind.lead":
    "Le recordaremos cuando empiece la votación anticipada, el día antes de la elección y el día de la elección.",
  "remind.how": "¿Cómo quiere recibir los recordatorios?",
  "remind.email": "Correo electrónico",
  "remind.sms": "Mensaje de texto",
  "remind.emailLabel": "Correo electrónico",
  "remind.phoneLabel": "Número de celular de EE. UU.",
  "remind.consentEmail":
    "Sí, envíenme recordatorios de votación por correo para esta elección. Puedo cancelar con un toque.",
  "remind.consentSms":
    "Sí, envíenme hasta 4 recordatorios de votación por texto para esta elección. Pueden aplicarse tarifas de mensajes y datos. Responda STOP para cancelar.",
  "remind.needConsent": "Marque la casilla para aceptar los recordatorios.",
  "remind.submit": "Inscribirme en los recordatorios",
  "remind.checkEmail": "¡Casi listo! Revise su correo y toque el enlace para confirmar.",
  "remind.checkPhone": "¡Casi listo! Revise sus mensajes y toque el enlace para confirmar.",
  "remind.badEmail": "Ingrese un correo electrónico válido.",
  "remind.badPhone": "Ingrese un número de celular de EE. UU. válido.",
  "remind.privacy":
    "Solo guardamos su correo o teléfono, su idioma y las fechas y el centro de votación de esta elección, nunca la dirección de su casa. Todo se borra después de la elección.",

  "reps.heading": "Quién le representa",
  "reps.lead": "Sus miembros del Congreso y legisladores estatales, según la dirección de su casa.",
  "reps.loading": "Buscando a sus representantes…",
  "reps.state": "Estado",
  "reps.cd": "Distrito del Congreso",
  "reps.upper": "Distrito del senado estatal",
  "reps.lower": "Distrito de la cámara estatal",
  "reps.county": "Condado",
  "reps.federal": "Congreso de EE. UU.",
  "reps.stateLeg": "Legislatura estatal",
  "reps.stateFallback": "Aún no podemos mostrar a los legisladores estatales aquí. Use la búsqueda oficial:",
  "reps.findState": "Buscar a sus legisladores estatales",
  "reps.none": "No se encontró a nadie para esta dirección.",
  "reps.contactForm": "Formulario de contacto",
  "reps.divisions": "Todos los distritos de esta dirección",
  "reps.note":
    "Los representantes aparecen por cargo, sin clasificación ni respaldo. Los distritos pueden cambiar después de una redistribución, así que confirme con las fuentes oficiales de su estado.",

  "report.heading": "Reportar un problema",
  "report.lead":
    "¿Vio información incorrecta o faltante, o algo que no funciona? Avísenos. Por favor no incluya la dirección de su casa.",
  "report.kind": "¿Qué tipo de problema?",
  "report.kind.wrong": "Información incorrecta",
  "report.kind.missing": "Información faltante",
  "report.kind.bug": "Algo no funciona",
  "report.kind.accessibility": "Problema de accesibilidad",
  "report.kind.other": "Otra cosa",
  "report.message": "¿Qué pasó?",
  "report.messageHint": "Incluya el nombre de la elección, la contienda o el lugar si ayuda.",
  "report.email": "Su correo (opcional, solo si quiere una respuesta)",
  "report.submit": "Enviar reporte",
  "report.thanks": "¡Gracias! Recibimos su reporte.",
  "report.error": "No pudimos enviar su reporte. Inténtelo de nuevo.",
};

export type Lang = "en" | "es";
export const dictionaries: Record<Lang, Dictionary> = { en, es };

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[lang][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  const saved = storage.get("civic.lang");
  if (saved === "en" || saved === "es") return saved;
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es")) return "es";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.set("civic.lang", l);
  }, []);
  const t = useCallback<TFunction>((key, vars) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
