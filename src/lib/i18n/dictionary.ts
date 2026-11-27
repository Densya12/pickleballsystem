/**
 * Typed dictionaries (D20). Each area's module defines `en` and a `fil`
 * typed as `typeof en`, so a missing or extra key fails typecheck; this file
 * puts them together. Plain objects and functions, no i18n library: the app
 * has two languages and no plural rules beyond what the functions handle.
 */
import { auth } from "./dict/auth";
import { club } from "./dict/club";
import { choices, common, levels, nav, status } from "./dict/common";
import { games } from "./dict/games";
import { guide } from "./dict/guide";
import { home, time } from "./dict/home";
import { legal } from "./dict/legal";
import { live } from "./dict/live";
import { members } from "./dict/members";
import { payments } from "./dict/payments";
import { player } from "./dict/player";
import { session } from "./dict/session";
import { settings } from "./dict/settings";
import { system } from "./dict/system";
import type { Locale } from "./locale";

export const en = {
  common: common.en,
  nav: nav.en,
  status: status.en,
  levels: levels.en,
  choices: choices.en,
  auth: auth.en,
  club: club.en,
  home: home.en,
  time: time.en,
  session: session.en,
  live: live.en,
  payments: payments.en,
  games: games.en,
  members: members.en,
  settings: settings.en,
  player: player.en,
  guide: guide.en,
  legal: legal.en,
  system: system.en,
};

export type Dictionary = typeof en;

export const fil: Dictionary = {
  common: common.fil,
  nav: nav.fil,
  status: status.fil,
  levels: levels.fil,
  choices: choices.fil,
  auth: auth.fil,
  club: club.fil,
  home: home.fil,
  time: time.fil,
  session: session.fil,
  live: live.fil,
  payments: payments.fil,
  games: games.fil,
  members: members.fil,
  settings: settings.fil,
  player: player.fil,
  guide: guide.fil,
  legal: legal.fil,
  system: system.fil,
};

export const dictionaries: Record<Locale, Dictionary> = { en, fil };
