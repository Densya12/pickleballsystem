/** Sign-in (organizers). */

const en = {
  pageTitle: "Sign in",
  title: "Sign in",
  subtitle: "For the people who run open play. Players don't need to sign in.",
  google: "Continue with Google",
  googleOpening: "Opening Google…",
  or: "or",
  email: "Email",
  emailPlaceholder: "juan@gmail.com",
  sendLink: "Email me a sign-in link",
  sending: "Sending…",
  checkEmail: "Check your email",
  sentTo: (email: string) => `We sent a sign-in link to ${email}. Open it to continue.`,
  resend: "Send again",
  resendIn: (s: number) => `You can send it again in ${s} s.`,
  otherEmail: "Use another email",
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
  title: "Mag-sign in bilang organizer",
  subtitle: "Para sa nag-aayos ng open play. Hindi kailangang mag-sign in ng mga player.",
  google: "Mag-sign in gamit ang Google",
  googleOpening: "Binubuksan ang Google…",
  or: "o",
  email: "Email mo",
  emailPlaceholder: "juan@gmail.com",
  sendLink: "Ipadala ang login link",
  sending: "Pinapadala…",
  checkEmail: "I-check ang email mo",
  sentTo: (email: string) => `Pinadala namin ang login link sa ${email}. Buksan ito para makapasok.`,
  resend: "Ipadala ulit",
  resendIn: (s: number) => `Pwede nang ipadala ulit pagkalipas ng ${s} segundo.`,
  otherEmail: "Gumamit ng ibang email",
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
