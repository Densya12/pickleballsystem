/** Sign-in (organizers), D22: the ink Sign in screen and its email states. */

const en = {
  pageTitle: "Sign in",
  // Top of the screen (decorative court above it).
  headline: "Open play,",
  headlineAccent: "one fair line.",
  subline: "Calls the next game, keeps the queue fair and shows who has paid.",
  // The sheet: start
  sheetTitle: "Sign in to run your club",
  sheetLead: "For organizers. Players just scan the QR at the court.",
  google: "Continue with Google",
  googleOpening: "Opening Google…",
  useEmail: "Use email instead",
  legalBefore: "By continuing you agree to the ",
  terms: "Terms",
  legalAnd: " and ",
  privacy: "Privacy Policy",
  legalAfter: ".",
  // The sheet: email
  emailTitle: "Sign in with email",
  email: "Email",
  emailHint: "We'll email you a link. No password needed.",
  sendLink: "Email me a sign-in link",
  sending: "Sending…",
  useGoogle: "Use Google instead",
  // The sheet: sent
  checkEmail: "Check your email",
  sentToBefore: "We sent a sign-in link to ",
  sentToAfter: ".",
  /** For screen readers when the sent state opens. */
  sentAnnounce: (email: string) => `Check your email. We sent a sign-in link to ${email}.`,
  sameBrowserBefore: "Open the link on ",
  sameBrowserBold: "this phone, in this browser",
  /** otp_expiry is 3600 s in supabase/config.toml. */
  sameBrowserAfter: ". It works once and expires in 1 hour.",
  resendIn: (time: string) => `Resend link in ${time}`,
  resend: "Resend link",
  otherEmail: "Use a different email",
  // The sheet: link failed (?error=link from /auth/confirm, ?error=auth from /auth/callback)
  linkFailedTitle: "That sign-in link didn't work",
  linkFailedBody: "It expired or was already used. Get a new one, or sign in with Google.",
  newLink: "Send a new email link",
  // Errors (unchanged)
  emailRequired: "Enter your email.",
  emailInvalid: "That email doesn't look right. E.g. juan@gmail.com",
  emailRefused: "We can't send a sign-in link right now. Try Google instead.",
  emailFailed: "The sign-in link wasn't sent. Check your internet and try again.",
  googleFailed: "Couldn't open Google sign-in. Try again.",
  callbackFailed: "Sign-in didn't finish. Try again.",
  linkExpired:
    "That sign-in link didn't work. It may have expired, been used, or been opened in another browser. Ask for a new one and open it in the same browser, or use Google.",
  notOrganizerAccount: "This needs an organizer account. Sign out, then sign in with Google or email.",
};

const fil: typeof en = {
  pageTitle: "Mag-sign in",
  headline: "Open play,",
  headlineAccent: "isang patas na pila.",
  subline: "Tinatawag ang susunod na laro, patas ang pila, at kita kung sino na ang bayad.",
  sheetTitle: "Mag-sign in para patakbuhin ang club mo",
  sheetLead: "Para sa mga organizer. Ang mga player, i-scan lang ang QR sa court.",
  google: "Mag-sign in gamit ang Google",
  googleOpening: "Binubuksan ang Google…",
  useEmail: "Email na lang ang gamitin",
  legalBefore: "Sa pagpapatuloy, sang-ayon ka sa ",
  terms: "Terms",
  legalAnd: " at ",
  privacy: "Privacy Policy",
  legalAfter: ".",
  emailTitle: "Mag-sign in gamit ang email",
  email: "Email mo",
  emailHint: "Ie-email namin sa iyo ang link. Walang password.",
  sendLink: "Ipadala ang login link",
  sending: "Pinapadala…",
  useGoogle: "Google na lang ang gamitin",
  checkEmail: "I-check ang email mo",
  sentToBefore: "Pinadala namin ang login link sa ",
  sentToAfter: ".",
  sentAnnounce: (email: string) => `I-check ang email mo. Pinadala namin ang login link sa ${email}.`,
  sameBrowserBefore: "Buksan ang link sa ",
  sameBrowserBold: "phone na ito, sa browser na ito",
  sameBrowserAfter: ". Isang beses lang ito gagana at mag-e-expire pagkalipas ng 1 oras.",
  resendIn: (time: string) => `Ipadala ulit pagkalipas ng ${time}`,
  resend: "Ipadala ulit ang link",
  otherEmail: "Ibang email ang gamitin",
  linkFailedTitle: "Hindi gumana ang login link",
  linkFailedBody: "Expired na o nagamit na. Humingi ng bago, o mag-sign in gamit ang Google.",
  newLink: "Magpadala ng bagong email link",
  emailRequired: "Pakilagay ang email mo.",
  emailInvalid: "Mukhang mali ang email. Hal. juan@gmail.com",
  emailRefused: "Hindi maipadala ang login link ngayon. Subukan ang Google sign-in.",
  emailFailed: "Hindi naipadala ang login link. I-check ang internet mo at subukan ulit.",
  googleFailed: "Hindi mabuksan ang Google sign-in. Subukan ulit.",
  callbackFailed: "Hindi natuloy ang pag-sign in. Subukan ulit.",
  linkExpired:
    "Hindi gumana ang login link. Baka expired na, nagamit na, o binuksan sa ibang browser. Humingi ng bago at buksan ito sa parehong browser kung saan ka humingi, o gamitin ang Google sign-in.",
  notOrganizerAccount:
    "Kailangan ng organizer account para dito. Mag-sign out, tapos mag-sign in gamit ang Google o email.",
};

export const auth = { en, fil };
