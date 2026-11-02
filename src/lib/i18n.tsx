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
