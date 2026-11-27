/**
 * Terms and Privacy (D22): plain-English drafts written from what the app
 * does today. Sources: the schema (supabase/migrations), the daily cleanup
 * job (20261124170100_phase7_cleanup.sql: anonymous player sign-ins removed
 * after 30 days without activity, at 03:00 Manila), invite links (7 days),
 * drafts-only session deletion (phase 2), and the QA fixes (the code preview
 * shows no payment details; names are cleaned of invisible characters).
 *
 * The Taglish dictionary uses the same English text (with a note): the legal
 * wording is kept in one language so the two can't drift apart.
 */

import { APP_NAME } from "@/lib/brand";

export type LegalSection = { title: string; paragraphs: string[] };

/** Date of the current drafts. */
const UPDATED = "November 26, 2026";

const privacySections: LegalSection[] = [
  {
    title: "What Pilaball is",
    paragraphs: [
      `${APP_NAME} is a free beta app that helps pickleball clubs run open play: a fair queue, calling players to courts, and a checklist of who has paid. Club organizers sign in. Players don't need an account: they scan the club's QR code and join the line on their phone.`,
    ],
  },
  {
    title: "What we collect",
    paragraphs: [
      "From organizers: your email address and, if you sign in with Google, the name on your Google account. The club details you enter: the club's name, city (optional), the payment method and the account name and number players should pay to, whether cash is accepted, the default fee and game settings, and the co-organizers you invite.",
      "From players, entered at check-in or by an organizer for a walk-in: a display name and a playing level. While a session runs we record your place in the line, the games you play, whether you are resting or not ready, and your payment status (unpaid, to check or paid) and method (the club's payment method, such as an e-wallet or bank transfer, or cash). If you or the organizer enter a reference number, we keep its digits so the organizer can find the payment.",
      "Organizers can also keep a members list for regulars: a name, a level, whether club dues are paid, and short notes.",
      "To keep your place in the line, your phone gets an anonymous sign-in, with no name or email attached. We store your language choice in a cookie. Each session keeps an activity log of queue and payment actions (what happened, when, and which organizer did it), used for Undo and to sort out mix-ups.",
      "We do not collect card numbers, we never ask players for their own bank or e-wallet details, and we have no access to anyone's accounts. The account name and number a club enters are shown to its players so they can pay. Money is paid directly to the club, outside the app; the app only records what the player or organizer tells it.",
    ],
  },
  {
    title: "Why we use it",
    paragraphs: [
      "To run the queue and rotation fairly, call players to courts, show organizers who has paid, let organizers recognize their regulars, sign organizers in, and keep each session's history for the club.",
      "We don't sell your information or use it for ads.",
    ],
  },
  {
    title: "Who can see what",
    paragraphs: [
      "The club's organizers (the owner and co-organizers) can see everything about their own club: its sessions, players, payments and members. Organizers of other clubs can't.",
      "Players in a session can see the line and the courts: the names of the people waiting and playing, and who is on hold, which, when the club asks players to pay first, includes who hasn't paid yet. Each player sees their own place, status and payment. Players don't see other players' reference numbers or payment methods.",
      "Before checking in, the session's code shows only the session's name, time and how many are waiting; payment details are shown after check-in.",
      "We use Supabase for the database, sign-in and sign-in emails, and Vercel to host the app. If you sign in with Google, Google handles that sign-in.",
    ],
  },
  {
    title: "How long we keep it",
    paragraphs: [
      "A player's anonymous sign-in is deleted automatically after 30 days without activity (a cleanup runs every day at 3:00 a.m. Manila time), unless the player is still in a live session. The player's entries in the club's past sessions stay, but are no longer linked to that phone.",
      "Session history (check-ins, games, payments and the activity log) and the members list are kept for as long as the club uses the app. There is no automatic deletion of session history yet: organizers can delete draft sessions, but not finished ones. Ask us if you want something deleted.",
      "Co-organizer invite links stop working after 7 days.",
      "Organizer accounts are kept until you ask us to delete them.",
    ],
  },
  {
    title: "Your rights",
    paragraphs: [
      "We follow the Data Privacy Act of 2012 (Republic Act No. 10173) of the Philippines. You can ask what we hold about you, and ask us to correct or delete it. Players can also ask their club's organizer, who can change or remove their entries. If you're not satisfied, you can contact the National Privacy Commission.",
    ],
  },
  {
    title: "Changes",
    paragraphs: ["This is a draft. We may update it as the app changes; the date at the top shows the latest version."],
  },
];

const termsSections: LegalSection[] = [
  {
    title: "The service",
    paragraphs: [
      `${APP_NAME} is a free beta service for running pickleball open play. It is provided "as is": it may change, have mistakes, or be unavailable at times. Don't use it as your only record of who has paid.`,
    ],
  },
  {
    title: "Organizer accounts",
    paragraphs: [
      "Organizers sign in with Google or with an email link. You're responsible for your account and for the co-organizers you invite to your club.",
    ],
  },
  {
    title: "Your players",
    paragraphs: [
      "Organizers are responsible for the players and members they add, and for what they enter about them. Use real first names or nicknames people are happy to see on screen, and let players know how the app is used (see the Privacy Policy).",
      `${APP_NAME} doesn't handle money. Fees are paid directly to the club, by the method the club chooses, and any question about a payment is between the player and the club.`,
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "Don't use the app to harass or embarrass anyone, enter information you have no right to share, use someone else's payment reference, check in people who aren't there, or try to break, overload or get into parts of the service that aren't yours (including other clubs' data). Don't use it for anything illegal.",
      "We may suspend accounts or remove content that breaks these rules.",
    ],
  },
  {
    title: "Liability",
    paragraphs: [
      "As far as the law allows, we're not liable for losses from using the app, such as a missed game, a wrong queue or a payment record that is out of date.",
    ],
  },
  {
    title: "Changes and ending",
    paragraphs: [
      "These terms may change; the date at the top shows the latest version, and using the app after a change means you accept it. You can stop using the app at any time and ask us to delete your data. These terms are governed by the laws of the Philippines.",
    ],
  },
];

const en = {
  draftLine: `Draft · last updated ${UPDATED}`,
  termsTitle: "Terms",
  privacyTitle: "Privacy Policy",
  /** Shown only in Taglish: the legal text stays in English. */
  englishNote: { show: false, text: "The full text is in English." },
  contact: (email: string) => `Questions or requests: ${email}`,
  privacySections,
  termsSections,
};

const fil: typeof en = {
  draftLine: `Draft · huling update ${UPDATED}`,
  termsTitle: "Terms",
  privacyTitle: "Privacy Policy",
  englishNote: { show: true, text: "Nasa English ang buong teksto, para iisa lang ang bersyon." },
  contact: (email: string) => `Mga tanong o hiling: ${email}`,
  privacySections,
  termsSections,
};

export const legal = { en, fil };
