/** Error and not-found pages, and the club QR landing page. */

const en = {
  errorTitle: "Something went wrong. Try again.",
  errorBody: "What you were doing didn't finish. If the signal is weak, wait for it to come back.",
  errorCode: (code: string) => `Code: ${code}`,
  backHome: "Back to Home",
  notFoundPageTitle: "Not found",
  notFoundTitle: "This page can't be found",
  notFoundBody: "The link may be wrong, it may have been deleted, or it isn't for your club.",
  goHome: "Go to Home",
  clubEntryEyebrow: "Open play",
  clubEntryNone: "No open play right now. Come back to this QR when a session starts.",
  clubEntryNotFound: "This QR can't be found. Ask the organizer for the new one.",
};

const fil: typeof en = {
  errorTitle: "May nagkaproblema. Subukan ulit.",
  errorBody: "Hindi natapos ang ginagawa mo. Kung mahina ang signal, hintayin munang bumalik ito.",
  errorCode: (code: string) => `Code: ${code}`,
  backHome: "Bumalik sa home",
  notFoundPageTitle: "Hindi makita",
  notFoundTitle: "Hindi makita ang page na ito",
  notFoundBody: "Baka mali ang link, nabura na ito, o hindi ito para sa club mo.",
  goHome: "Pumunta sa home",
  clubEntryEyebrow: "Pumila sa open play",
  clubEntryNone: "Wala pang open play ngayon. Balikan ang QR na ito kapag nagsimula na ang session.",
  clubEntryNotFound: "Hindi makita ang QR na ito. Tanungin ang organizer kung may bagong QR.",
};

export const system = { en, fil };
