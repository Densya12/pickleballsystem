# UI audit: screenshots and findings

Kenji’s note: the UI feels cluttered (“ang kalat”). This audit records what the screens actually
show today, with numbers, so the cleanup can be planned from evidence. **Facts only, no fixes.**
Items marked *(judged by eye)* or *(unsure)* are not measured.

- Screens: [`screens/`](screens/) (Pixel-like Chromium, 390×844 at 2×; Live, Bayad and Pwesto also
  at 360×800). Full-page captures.
- Raw measurements: [`metrics.json`](metrics.json) (every count below, plus button labels,
  headings, repeated texts and button style signatures per screen).
- Reproduce: `npx supabase start`, then
  `PORT=3100 npx playwright test -c scripts/ui-audit/playwright.config.ts`
  ([`scripts/ui-audit/`](../../scripts/ui-audit/)). It seeds a new club through the app’s own
  screens (magic links from the local Mailpit), so seed data lives only in the local database.

## Seed data

One club (“Pasig Pickleball Club”, GCash Juan Dela Cruz 0917 123 4567), 2 staff (owner + an
invited organizer), 12 members. One live session (“Biyernes Night Open Play”): 3 courts with Court 3
singles, winners stay, pay first on, ₱150, 18 players (6 phone check-ins, 12 walk-ins picked from
members), games on all 3 courts, 2 pending GCash (Ana Lopez, Ben Ocampo), 2 unpaid and held (Mika
Torres, Carla Diaz), 1 paused (Ella Marquez), 1 not-ready flag (Fe Castillo). One draft (“Sabado
Smash”) and two ended sessions (“Huwebes Open Play”, “Martes Open Play”).

Seed artifacts to ignore: times read 1:00 AM (the seed ran at night); “Tagal 0 minuto” on the
summary; both past sessions are dated the same day.

## How the numbers are measured

Measured in the browser from computed styles (see [`scripts/ui-audit/metrics.ts`](../../scripts/ui-audit/metrics.ts)):

| Count | Definition |
| --- | --- |
| Buttons | Visible `<button>`s, plus links drawn as buttons (centered flex, ≥44px tall, with a fill or border). Text links such as “Bumalik” and “Ipakita lahat” are not counted. |
| Primary | Buttons filled with ink (black) or accent (lime). |
| Cards/boxes | Non-button, non-form elements with radius ≥8px, height ≥40px and a border or a fill different from their parent: cards, notices, tiles, list containers, info boxes. |
| Option cards | Radio/switch rows drawn as bordered cards (form labels), counted separately. |
| Font sizes / text colors | Distinct computed values among visible text (screen-reader-only text excluded). |
| Hint lines | Text in the muted grey, outside buttons and links. |
| Icons | Decorative SVG icons. |

Full-page captures draw fixed and sticky elements (the bottom sheet, sticky “I-save” and “Simulan”
footers) where the first screen ended, so they can appear mid-image. That is a capture artifact,
not how the phone shows it.

## Per screen

| Screen | Viewport | Page height | Buttons | Primary | Cards/boxes | Option cards | Font sizes | Text colors | Hint lines | Icons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Login](screens/01-login.png) | 390×844 | 844px | 2 | 1 | 0 | 0 | 3 (17, 18, 30) | 3 (ink, muted, white (on-primary)) | 2 | 1 |
| [Club/new (first club)](screens/02-club-new.png) | 390×844 | 844px | 1 | 1 | 0 | 0 | 3 (17, 18, 30) | 3 (ink, muted, white (on-primary)) | 1 | 0 |
| [Home (empty club)](screens/03-home-empty.png) | 390×844 | 844px | 4 | 1 | 2 | 0 | 4 (17, 18, 24, 30) | 3 (muted, ink, white (on-primary)) | 3 | 1 |
| [Home (live + drafts + past)](screens/04-home-full.png) | 390×844 | 1219px | 6 | 2 | 4 | 0 | 6 (14, 17, 18, 20, 24, 30) | 4 (muted, ink, on-accent-soft, white (on-primary)) | 2 | 6 |
| [Bagong open play (empty)](screens/05-sessions-new.png) | 390×844 | 1769px | 4 | 1 | 4 | 10 | 6 (14, 16, 17, 18, 20, 30) | 3 (ink, muted, white (on-primary)) | 5 | 3 |
| [Bagong open play (Ulitin pre-filled)](screens/06-sessions-new-ulitin.png) | 390×844 | 1824px | 4 | 1 | 4 | 10 | 6 (14, 16, 17, 18, 20, 30) | 3 (ink, muted, white (on-primary)) | 6 | 3 |
| [Live (busy) (360×800)](screens/07-live-busy-360.png) | 360×800 | 2716px | 15 | 4 | 18 | 1 | 7 (14, 16, 17, 18, 20, 24, 30) | 5 (ink, muted, warn, white (on-primary), danger) | 7 | 18 |
| [Live (busy)](screens/07-live-busy.png) | 390×844 | 2445px | 15 | 4 | 18 | 1 | 7 (14, 16, 17, 18, 20, 24, 30) | 5 (ink, muted, warn, white (on-primary), danger) | 7 | 18 |
| [Live (winner picker open)](screens/08-live-winner-picker.png) | 390×844 | 2753px | 20 | 3 | 19 | 1 | 7 (14, 16, 17, 18, 20, 24, 30) | 5 (ink, muted, warn, white (on-primary), danger) | 8 | 18 |
| [Live (queue player sheet open)](screens/09-live-player-sheet.png) | 390×844 | 2445px | 19 | 5 | 19 | 1 | 7 (14, 16, 17, 18, 20, 24, 30) | 5 (ink, muted, warn, white (on-primary), danger) | 8 | 19 |
| [Live (undo banner)](screens/10-live-undo-banner.png) | 390×844 | 2595px | 17 | 4 | 19 | 1 | 7 (14, 16, 17, 18, 20, 24, 30) | 6 (ink, muted, success, warn, white (on-primary), danger) | 7 | 20 |
| [Live (offline, 1 action waiting)](screens/11-live-offline-outbox.png) | 390×844 | 2583px | 15 | 4 | 20 | 1 | 7 (14, 16, 17, 18, 20, 24, 30) | 5 (ink, muted, warn, white (on-primary), danger) | 7 | 19 |
| [Walk-in](screens/12-walk-in.png) | 390×844 | 1238px | 1 | 1 | 1 | 7 | 5 (14, 16, 17, 18, 30) | 3 (ink, muted, white (on-primary)) | 3 | 2 |
| [Session QR](screens/13-session-qr.png) | 390×844 | 1041px | 2 | 1 | 2 | 0 | 5 (17, 18, 20, 30, 48) | 3 (ink, muted, white (on-primary)) | 2 | 4 |
| [Bayad (360×800)](screens/14-bayad-360.png) | 360×800 | 1514px | 8 | 4 | 5 | 0 | 6 (14, 16, 17, 20, 24, 30) | 3 (ink, muted, white (on-primary)) | 7 | 7 |
| [Bayad](screens/14-bayad.png) | 390×844 | 1514px | 8 | 4 | 5 | 0 | 6 (14, 16, 17, 20, 24, 30) | 3 (ink, muted, white (on-primary)) | 7 | 7 |
| [Buod ng session (ended)](screens/15-buod.png) | 390×844 | 1805px | 2 | 1 | 8 | 0 | 6 (14, 17, 18, 20, 24, 30) | 4 (ink, muted, white (on-primary), success) | 15 | 8 |
| [Mga member](screens/16-members.png) | 390×844 | 1313px | 1 | 1 | 1 | 0 | 3 (17, 18, 30) | 3 (ink, white (on-primary), muted) | 0 | 14 |
| [Member (edit)](screens/17-member-edit.png) | 390×844 | 996px | 1 | 1 | 1 | 7 | 3 (17, 18, 30) | 2 (ink, white (on-primary)) | 0 | 1 |
| [Settings (owner)](screens/18-settings-owner.png) | 390×844 | 2703px | 7 | 2 | 6 | 5 | 6 (14, 16, 17, 18, 24, 30) | 4 (ink, muted, white (on-primary), danger) | 7 | 3 |
| [Gabay (guide)](screens/19-guide.png) | 390×844 | 2645px | 1 | 0 | 0 | 0 | 4 (17, 20, 24, 36) | 2 (ink, muted) | 1 | 2 |
| [Invite (signed in, before joining)](screens/20-invite.png) | 390×844 | 844px | 1 | 1 | 1 | 0 | 3 (17, 18, 30) | 2 (ink, white (on-primary)) | 0 | 0 |
| [Check-in (fee, first time)](screens/21-checkin-first-time.png) | 390×844 | 1403px | 2 | 1 | 2 | 5 | 7 (14, 16, 17, 18, 20, 24, 30) | 2 (muted, ink) | 8 | 0 |
| [Check-in (returning: Pumila bilang)](screens/22-checkin-pumila-bilang.png) | 390×844 | 1195px | 3 | 1 | 3 | 1 | 7 (14, 16, 17, 18, 20, 24, 30) | 2 (muted, ink) | 10 | 0 |
| [Pwesto (queued) (360×800)](screens/23-pwesto-queued-360.png) | 360×800 | 800px | 3 | 0 | 3 | 0 | 5 (16, 17, 18, 30, 60) | 4 (muted, ink, success, danger) | 4 | 4 |
| [Pwesto (queued)](screens/23-pwesto-queued.png) | 390×844 | 844px | 3 | 0 | 3 | 0 | 5 (16, 17, 18, 30, 60) | 4 (muted, ink, success, danger) | 4 | 4 |
| [Pwesto (held for payment)](screens/24-pwesto-held.png) | 390×844 | 1020px | 4 | 0 | 3 | 0 | 5 (17, 18, 20, 30, 60) | 4 (muted, ink, warn, danger) | 4 | 3 |
| [Pwesto (called) (360×800)](screens/25-pwesto-called-360.png) | 360×800 | 800px | 3 | 1 | 5 | 0 | 4 (17, 18, 20, 30) | 4 (ink, success, white (on-primary), danger) | 0 | 3 |
| [Pwesto (called)](screens/25-pwesto-called.png) | 390×844 | 844px | 3 | 1 | 5 | 0 | 4 (17, 18, 20, 30) | 4 (ink, success, white (on-primary), danger) | 0 | 3 |
| [Pwesto (paused)](screens/26-pwesto-paused.png) | 390×844 | 844px | 3 | 1 | 2 | 0 | 4 (16, 17, 18, 30) | 5 (muted, ink, success, white (on-primary), danger) | 1 | 3 |
| [Mga court](screens/27-mga-court.png) | 390×844 | 1389px | 0 | 0 | 16 | 0 | 4 (14, 17, 24, 30) | 4 (ink, muted, white (on-primary), warn) | 10 | 1 |
| [/c/[code] (nothing live)](screens/28-club-qr-none.png) | 390×844 | 844px | 0 | 0 | 1 | 0 | 3 (16, 17, 30) | 2 (muted, ink) | 1 | 1 |

### 01. Login

[Screenshot](screens/01-login.png)

- **Counts:** 2 buttons (1 primary), 0 cards/boxes, 3 font sizes, 3 text colors, 2 hint lines, page 844px tall.
- **Primary buttons:** “Mag-sign in gamit ang Google”.
- **Eye lands first on:** the 30px heading “Mag-sign in bilang organizer”, then the black Google button.
- **Main task and taps:** Sign in: 1 tap (Google), or type email + 1 tap + open the email link.
- **Repeated on this screen:** nothing notable.

### 02. Club/new (first club)

[Screenshot](screens/02-club-new.png)

- **Counts:** 1 buttons (1 primary), 0 cards/boxes, 3 font sizes, 3 text colors, 1 hint lines, page 844px tall.
- **Primary buttons:** “Gawin ang club”.
- **Eye lands first on:** the 30px heading “Gawin ang club mo”.
- **Main task and taps:** Create the club: type a name + 1 tap.
- **Repeated on this screen:** nothing notable.

### 03. Home (empty club)

[Screenshot](screens/03-home-empty.png)

- **Counts:** 4 buttons (1 primary), 2 cards/boxes, 4 font sizes, 3 text colors, 3 hint lines, page 844px tall.
- **Primary buttons:** “Bagong open play”.
- **Eye lands first on:** the club name (30px), then the black “Bagong open play”.
- **Main task and taps:** Start a session: 1 tap to the form, type a name, 1 tap “Simulan” = 2 taps + typing.
- **Repeated / notable on this screen:**
  - Two empty-state boxes (“Wala pang naka-schedule…”, “Wala pang natapos…”) stacked under their headings

### 04. Home (live + drafts + past)

[Screenshot](screens/04-home-full.png)

- **Counts:** 6 buttons (2 primary), 4 cards/boxes, 6 font sizes, 4 text colors, 2 hint lines, page 1219px tall (≈1.4 screens).
- **Primary buttons:** “Buksan ang session”, “Bagong open play”.
- **Eye lands first on:** the lime LIVE NGAYON card with its black “Buksan ang session” button (judged by eye).
- **Main task and taps:** Open the live session: 1 tap. Repeat last session: 2 taps (Ulitin, Simulan).
- **Repeated / notable on this screen:**
  - Two filled black buttons one under the other (“Buksan ang session”, “Bagong open play”)
  - “Nob 25, 2026” ×2 (both past sessions are on the same day in the seed)
  - Three outlined full-width buttons at the bottom (Mga member, Settings ng club, Gabay) styled like actions, not navigation

### 05. Bagong open play (empty)

[Screenshot](screens/05-sessions-new.png)

- **Counts:** 4 buttons (1 primary), 4 cards/boxes, 10 option cards, 6 font sizes, 3 text colors, 5 hint lines, page 1769px tall (≈2.1 screens).
- **Primary buttons:** “Simulan ang session”.
- **Eye lands first on:** the 30px heading.
- **Main task and taps:** Start: type a name, 1 tap “Simulan ang session” (everything else has defaults).
- **Repeated / notable on this screen:**
  - “Doubles”/“Singles” radio pair repeated per court
  - The court stepper’s value is clipped: “2 court|s” runs under the “Dagdag” button at 390px (visible in the screenshot)

### 06. Bagong open play (Ulitin pre-filled)

[Screenshot](screens/06-sessions-new-ulitin.png)

- **Counts:** 4 buttons (1 primary), 4 cards/boxes, 10 option cards, 6 font sizes, 3 text colors, 6 hint lines, page 1824px tall (≈2.2 screens).
- **Primary buttons:** “Simulan ang session”.
- **Eye lands first on:** the 30px heading, then the “Kinopya mula sa …” line.
- **Main task and taps:** 1 tap “Simulan ang session”.
- **Repeated / notable on this screen:**
  - Same as 05, plus one more hint line

### 07. Live (busy)

[Screenshot](screens/07-live-busy.png) · [360×800](screens/07-live-busy-360.png)

- **Counts:** 15 buttons (4 primary), 18 cards/boxes, 1 option cards, 7 font sizes, 5 text colors, 7 hint lines, page 2445px tall (≈2.9 screens).
- **Primary buttons:** “Tapos na · tawagin ang susunod”, “Tapos na · tawagin ang susunod”, “Tapos na · tawagin ang susunod”, “Walk-in”.
- **Eye lands first on:** the session name (30px) and the lime LIVE pill; below the fold, three identical black “Tapos na · tawagin ang susunod” bars (judged by eye).
- **Main task and taps:** Finish a game: this session is winners-stay, so 1 tap + pick winners (2 doubles / 1 singles) + 1 tap “Kumpirmahin” = 4 taps (doubles), 3 (singles). All-off sessions: 1 tap. Swap a not-ready player: 1 tap (Palitan).
- **Repeated / notable on this screen:**
  - “Tapos na · tawagin ang susunod” ×3 (one per court), each wrapping to two lines at 390px
  - Fe Castillo’s not-ready state shown twice: in her tile (“Hindi pa handa”) and in the warning box (“Hindi pa handa si Fe Castillo”)
  - “Naglalaro 10” repeats what the 10 names on the court cards show; “Nakapila 8” repeats the 8-row queue just below; “3 courts” in the header repeats the 3 court cards
  - Queue names wrap to 2–3 lines when a status chip sits beside them (“Mika / Torres”, “Carla / Diaz / Hindi / sigurado”)
  - 4 filled buttons: the 3 “Tapos na” bars and “Walk-in”

### 08. Live (winner picker open)

[Screenshot](screens/08-live-winner-picker.png)

- **Counts:** 20 buttons (3 primary), 19 cards/boxes, 1 option cards, 7 font sizes, 5 text colors, 8 hint lines, page 2753px tall (≈3.3 screens).
- **Primary buttons:** “Tapos na · tawagin ang susunod”, “Tapos na · tawagin ang susunod”, “Walk-in”.
- **Eye lands first on:** the open picker on Court 1 (black-bordered box, judged by eye).
- **Main task and taps:** Pick 2 winners + “Kumpirmahin” = 3 more taps.
- **Repeated / notable on this screen:**
  - The 4 players appear twice on Court 1: as the court tiles and again as the picker’s buttons

### 09. Live (queue player sheet open)

[Screenshot](screens/09-live-player-sheet.png)

- **Counts:** 19 buttons (5 primary), 19 cards/boxes, 1 option cards, 7 font sizes, 5 text colors, 8 hint lines, page 2445px tall (≈2.9 screens).
- **Primary buttons:** “Tapos na · tawagin ang susunod”, “Tapos na · tawagin ang susunod”, “Tapos na · tawagin ang susunod”, “I-pause”, “Walk-in”.
- **Eye lands first on:** the sheet’s black “I-pause” button.
- **Main task and taps:** Pause: 1 tap to open + 1 tap = 2. Remove: open, “Alisin sa pila”, “Oo, alisin” = 3.
- **Repeated / notable on this screen:**
  - Ana Lopez named in the sheet and in the queue row behind it
  - Screenshot artifact: the sheet is fixed to the bottom of the screen, so a full-page capture draws it at the first viewport’s bottom (mid-image)

### 10. Live (undo banner)

[Screenshot](screens/10-live-undo-banner.png)

- **Counts:** 17 buttons (4 primary), 19 cards/boxes, 1 option cards, 7 font sizes, 6 text colors, 7 hint lines, page 2595px tall (≈3.1 screens).
- **Primary buttons:** “Tapos na · tawagin ang susunod”, “Tapos na · tawagin ang susunod”, “Tapos na · tawagin ang susunod”, “Walk-in”.
- **Eye lands first on:** the green banner at the top with “Ibalik (30s)” (judged by eye).
- **Main task and taps:** Undo: 1 tap within 30 s.
- **Repeated / notable on this screen:**
  - The winner is named twice in one banner: “Panalo: Hector Cruz. Tinawag: Hector Cruz, Ana Lopez”
  - “Isara” is an underlined text link next to the bordered “Ibalik” button: two different button styles side by side

### 11. Live (offline, 1 action waiting)

[Screenshot](screens/11-live-offline-outbox.png)

- **Counts:** 15 buttons (4 primary), 20 cards/boxes, 1 option cards, 7 font sizes, 5 text colors, 7 hint lines, page 2583px tall (≈3.1 screens).
- **Primary buttons:** “Tapos na · tawagin ang susunod”, “Tapos na · tawagin ang susunod”, “Tapos na · tawagin ang susunod”, “Walk-in”.
- **Eye lands first on:** the orange-bordered “Offline — ise-save pagbalik ng signal” bar.
- **Main task and taps:** Same as Live; the waiting action needs no tap.
- **Repeated / notable on this screen:**
  - The pending pause (“I-pause si Leo Navarro”) is listed at the top while Leo still shows as a normal queue row below (no pending mark on the row)
  - Two stacked status boxes (offline bar + “Hinihintay ang signal”) above the stats

### 12. Walk-in

[Screenshot](screens/12-walk-in.png)

- **Counts:** 1 buttons (1 primary), 1 cards/boxes, 7 option cards, 5 font sizes, 3 text colors, 3 hint lines, page 1238px tall (≈1.5 screens).
- **Primary buttons:** “Ilagay sa pila”.
- **Eye lands first on:** the 30px heading.
- **Main task and taps:** Regular from members: type to search, 1 tap the name, 1 tap payment, 1 tap “Ilagay sa pila” = 3 taps + typing. New person: type name, 1 tap payment, 1 tap = 2 taps + typing.
- **Repeated / notable on this screen:**
  - Two text fields before the name: “Pumili sa members” search and “Pangalan” look the same
  - The GCash reference field is always shown, even when cash or “Mamaya” is chosen

### 13. Session QR

[Screenshot](screens/13-session-qr.png)

- **Counts:** 2 buttons (1 primary), 2 cards/boxes, 5 font sizes, 3 text colors, 2 hint lines, page 1041px tall (≈1.2 screens).
- **Primary buttons:** “I-share sa Messenger”.
- **Eye lands first on:** the QR code, then the 48px join code.
- **Main task and taps:** Share the link: 1 tap. Print: 1 tap.
- **Repeated / notable on this screen:**
  - The join link is shown twice: as the QR and as the URL in “O pumunta sa:”; the join code is a third way to reach the same thing
  - “I-print ang QR” also exists in Settings (club QR)

### 14. Bayad

[Screenshot](screens/14-bayad.png) · [360×800](screens/14-bayad-360.png)

- **Counts:** 8 buttons (4 primary), 5 cards/boxes, 6 font sizes, 3 text colors, 7 hint lines, page 1514px tall (≈1.8 screens).
- **Primary buttons:** “Natanggap na”, “Natanggap na”, “Natanggap na (cash)”, “Natanggap na (cash)”.
- **Eye lands first on:** the 30px “Bayad” heading and the ₱2,100 total; then four black “Natanggap na” buttons (judged by eye).
- **Main task and taps:** Confirm a payment: 1 tap per player (GCash: optional “Ipakita lahat” first).
- **Repeated / notable on this screen:**
  - Counts shown twice: “2 i-check · 2 hindi pa” in the summary card and again in the section headings “(2)” “(2)”; “14 bayad” again as “Bayad na (14)”
  - Each pending card has an “I-check” chip under the heading “I-check sa GCash mo”
  - 4 filled buttons on one screen

### 15. Buod ng session (ended)

[Screenshot](screens/15-buod.png)

- **Counts:** 2 buttons (1 primary), 8 cards/boxes, 6 font sizes, 4 text colors, 15 hint lines, page 1805px tall (≈2.1 screens).
- **Primary buttons:** “I-download (Excel)”.
- **Eye lands first on:** the 30px “Buod ng session”, then the black “I-download (Excel)” bar.
- **Main task and taps:** Download: 1 tap. Remind an unpaid player: 1 tap each.
- **Repeated / notable on this screen:**
  - “Courts” twice: the stat tile (1) and the details card (“1 court”); the fee also appears in the details card
  - Karen Aquino appears in “Hindi pa bayad” and in “Laro bawat player”
  - “Member na” ×5 (one per row)
  - “1 hindi pa” in the card and “Hindi pa bayad (1)” as a heading
  - Seed artifact: “Tagal 0 minuto” (the seeded session ran for seconds)

### 16. Mga member

[Screenshot](screens/16-members.png)

- **Counts:** 1 buttons (1 primary), 1 cards/boxes, 3 font sizes, 3 text colors, 0 hint lines, page 1313px tall (≈1.6 screens).
- **Primary buttons:** “Magdagdag ng member”.
- **Eye lands first on:** the black “Magdagdag ng member” button.
- **Main task and taps:** Find a member: type in Hanapin. Add: 1 tap → form. Edit: 1 tap the row.
- **Repeated / notable on this screen:**
  - Dues text wraps to a second line on some rows (“Hindi pa bayad ang / dues”)

### 17. Member (edit)

[Screenshot](screens/17-member-edit.png)

- **Counts:** 1 buttons (1 primary), 1 cards/boxes, 7 option cards, 3 font sizes, 2 text colors, 0 hint lines, page 996px tall (≈1.2 screens).
- **Primary buttons:** “I-save”.
- **Eye lands first on:** the 30px heading.
- **Main task and taps:** Change and save: 1–2 taps + 1 tap “I-save”.
- **Repeated on this screen:** nothing notable.

### 18. Settings (owner)

[Screenshot](screens/18-settings-owner.png)

- **Counts:** 7 buttons (2 primary), 6 cards/boxes, 5 option cards, 6 font sizes, 4 text colors, 7 hint lines, page 2703px tall (≈3.2 screens).
- **Primary buttons:** “I-print ang QR”, “I-save”.
- **Eye lands first on:** the 30px heading; the sticky black “I-save” bar.
- **Main task and taps:** Change a setting: edit + 1 tap “I-save”.
- **Repeated / notable on this screen:**
  - Two filled buttons: the sticky “I-save” and the club card’s “I-print ang QR”
  - “Gabay para sa organizer” also on Home
  - Organizers are shown by email (no names for magic-link sign-ups); long emails wrap over 2–3 lines
  - Screenshot artifact: the sticky footer is drawn where the first viewport ended, covering part of “Default na rules”

### 19. Gabay (guide)

[Screenshot](screens/19-guide.png)

- **Counts:** 1 buttons (0 primary), 0 cards/boxes, 4 font sizes, 2 text colors, 1 hint lines, page 2645px tall (≈3.1 screens).
- **Eye lands first on:** the 36px heading (the only 36px h1 in the app).
- **Main task and taps:** Read; print: 1 tap.
- **Repeated on this screen:** nothing notable.

### 20. Invite (signed in, before joining)

[Screenshot](screens/20-invite.png)

- **Counts:** 1 buttons (1 primary), 1 cards/boxes, 3 font sizes, 2 text colors, 0 hint lines, page 844px tall.
- **Primary buttons:** “Sumali”.
- **Eye lands first on:** the 30px heading “Sumali bilang organizer ng …”.
- **Main task and taps:** Join: 1 tap.
- **Repeated on this screen:** nothing notable.

### 21. Check-in (fee, first time)

[Screenshot](screens/21-checkin-first-time.png)

- **Counts:** 2 buttons (1 primary), 2 cards/boxes, 5 option cards, 7 font sizes, 2 text colors, 8 hint lines, page 1403px tall (≈1.7 screens).
- **Primary buttons:** “Pumila na”.
- **Eye lands first on:** the 30px session name; at the bottom, the lime “Pumila na”.
- **Main task and taps:** Check in: type a name, type a GCash reference or 1 tap “Cash”, 1 tap “Pumila na” = 1–2 taps + typing (level optional: +1).
- **Repeated / notable on this screen:**
  - Two privacy lines and a hint under each field: 8 muted hint lines on one form
  - A bordered “Bayad” box inside a white card (a box inside a box)

### 22. Check-in (returning: Pumila bilang)

[Screenshot](screens/22-checkin-pumila-bilang.png)

- **Counts:** 3 buttons (1 primary), 3 cards/boxes, 1 option cards, 7 font sizes, 2 text colors, 10 hint lines, page 1195px tall (≈1.4 screens).
- **Primary buttons:** “Pumila bilang Ana Lopez”.
- **Eye lands first on:** the 30px session name; then the grey “Nakapila ka na dati bilang Ana Lopez” box.
- **Main task and taps:** Check in: type a reference or 1 tap “Cash”, then 1 tap “Pumila bilang …” = 2 taps (or 1 tap + typing).
- **Repeated / notable on this screen:**
  - The name appears 3 times: in the grey box, the lime button and “Hindi ako si Ana Lopez”
  - 10 muted hint lines

### 23. Pwesto (queued)

[Screenshot](screens/23-pwesto-queued.png) · [360×800](screens/23-pwesto-queued-360.png)

- **Counts:** 3 buttons (0 primary), 3 cards/boxes, 5 font sizes, 4 text colors, 4 hint lines, page 844px tall.
- **Eye lands first on:** the 60px “#1”.
- **Main task and taps:** Nothing to do while waiting; see courts: 1 tap.
- **Repeated / notable on this screen:**
  - “#1 sa pila” and the green “Sa susunod na bakanteng court ka na” say related things back to back
  - No filled button: three outlined buttons (Pahinga muna, Aalis na ako in red, Tingnan ang mga court)

### 24. Pwesto (held for payment)

[Screenshot](screens/24-pwesto-held.png)

- **Counts:** 4 buttons (0 primary), 3 cards/boxes, 5 font sizes, 4 text colors, 4 hint lines, page 1020px tall (≈1.2 screens).
- **Eye lands first on:** the 60px “#7”.
- **Main task and taps:** Pay: 1 tap “Ilagay ang GCash reference” → form.
- **Repeated / notable on this screen:**
  - The hold is stated twice: the orange box “Hindi pa bayad · ₱150 / Cash: ibigay sa organizer.” and the bold line “Nilalaktawan ka muna hangga’t hindi bayad.”
  - “#7” is large although the player can’t be called until paid (judgement: the number competes with the hold message)

### 25. Pwesto (called)

[Screenshot](screens/25-pwesto-called.png) · [360×800](screens/25-pwesto-called-360.png)

- **Counts:** 3 buttons (1 primary), 5 cards/boxes, 4 font sizes, 4 text colors, 0 hint lines, page 844px tall.
- **Primary buttons:** “Papunta na ako”.
- **Eye lands first on:** the lime “Pumunta ka na sa Court 1” banner.
- **Main task and taps:** Acknowledge: 1 tap “Papunta na ako”.
- **Repeated / notable on this screen:**
  - No h1 on this screen (the big line is a 30px paragraph)
  - Payment status still shown while being called (“Bayad na · ₱150”)

### 26. Pwesto (paused)

[Screenshot](screens/26-pwesto-paused.png)

- **Counts:** 3 buttons (1 primary), 2 cards/boxes, 4 font sizes, 5 text colors, 1 hint lines, page 844px tall.
- **Primary buttons:** “Handa na ulit akong maglaro”.
- **Eye lands first on:** the 30px “Nagpapahinga ka”.
- **Main task and taps:** Come back: 1 tap “Handa na ulit akong maglaro”.
- **Repeated on this screen:** nothing notable.

### 27. Mga court

[Screenshot](screens/27-mga-court.png)

- **Counts:** 0 buttons (0 primary), 16 cards/boxes, 4 font sizes, 4 text colors, 10 hint lines, page 1389px tall (≈1.6 screens).
- **Eye lands first on:** the three court cards (judged by eye).
- **Main task and taps:** Read only; back: 1 tap.
- **Repeated / notable on this screen:**
  - Numbering restarts: “Maghanda na” 1–4, then “Susunod pagkatapos” starts at 1 again
  - Fe Castillo’s “not ready” state (shown on the organizer’s Live) is not shown here
  - Status wording differs from Live: “bayad muna” here vs “Hold · bayad muna” on Live vs “Naka-hold” on Bayad; “nagpapahinga” here vs “Naka-pause” on Live

### 28. /c/[code] (nothing live)

[Screenshot](screens/28-club-qr-none.png)

- **Counts:** 0 buttons (0 primary), 1 cards/boxes, 3 font sizes, 2 text colors, 1 hint lines, page 844px tall.
- **Eye lands first on:** the club name (30px).
- **Main task and taps:** Nothing to do; one info box.
- **Repeated on this screen:** nothing notable.

## Across screens

### Spacing
- Gaps between the main blocks differ by screen (from the code, *unsure how visible*): Home and
  Settings 32px, Live, Bayad, Buod and Mga court 24px, Pwesto, check-in and walk-in 20px.
- Live and Bayad are the longest working screens: Live is 2,445px at 390×844 (≈2.9 screens) and
  2,716px at 360×800 (≈3.4 screens); Bayad 1,514px; Settings 2,703px (≈3.2 screens).
- At 360px no screen scrolls sideways (measured), but text wraps more: queue names with a chip wrap
  to 2–3 lines on Live at both widths.

### Radii and borders
- Only three radii are used: 14px (controls, buttons, inner boxes), 20px (cards) and full (chips).
  Consistent across all screens (measured).
- Borders: the code uses both 1px (`border`) and 1.5px (`border-[1.5px]`) borders. Chrome reports
  both as 1px in this run, so the measured value is 1px everywhere. *(unsure whether the 1.5px
  borders render visibly thicker on a real phone)*
- Shadows: cards have a soft shadow; inner boxes (grey info boxes, coloured notices) don’t.

### Buttons
Distinct button styles measured across screens (fill | border | height | text size):

| Style | Where |
| --- | --- |
| Black filled, 56px, 18px text | Most main actions: Bagong open play, Buksan ang session, Simulan, Walk-in, Tapos na, I-download, Magdagdag ng member, I-save (members), Papunta na ako |
| Black filled, 61px | “Tapos na · tawagin ang susunod”: the same 56px style, taller because the label wraps to two lines at 390px and 360px |
| Black filled, 48px, 17px text | Bayad’s “Natanggap na” / “Natanggap na (cash)” and Settings’ “I-print ang QR” (measured: only these two screens) |
| Lime filled, 56px | Check-in (“Pumila na”, “Pumila bilang …”); also Live’s “Tawagin ang susunod” on an empty court (from the code; no court was empty in these screenshots) |
| White with black border, 48px and 56px | Secondary actions (both sizes are used) |
| White with red border, 48px and 56px | Destructive (Alisin, Aalis na ako, Tapusin ang session) |
| Underlined text link | Ipakita lahat, Isara, May permanenteng QR ang club, Ipakita/Itago (Bayad na) |
| Bordered small button with icon | Ibalik (30s) in the banner |
| Plain rows with chevron | Queue rows, Home session rows, members rows |

- Screens with more than one filled (primary) button: Home (2), Live (4), Bayad (4), Settings (2),
  Live with the sheet open (5).
- Icons on buttons are uneven: “Walk-in”, “Ipakita ang QR”, “Natanggap na”, “I-print”, “Pahinga muna”
  have icons; “Tapos na · tawagin ang susunod”, “Paalalahanan”, “Papunta na ako”, the Home nav
  buttons and “Pumila na” don’t.

### Headings and type
- 10 font sizes are used across the app: 14, 16, 17, 18, 20, 24, 30, 36, 48, 60px. Body text is 17px
  (`text-body`); 16px and 18px also appear for body-like text (16px hints, 18px button labels).
- h1 is 30px on every screen except the guide (36px). Pwesto (called) has no h1.
- The same kind of heading changes size between screens:
  - Court names: 20px h3 on Live, 24px h2 on Mga court.
  - “Hindi pa bayad”: 24px h2 on Bayad, 20px h3 on Buod.
  - Section headings on player screens (“Bayad · ₱150”, “Mga nauuna sa iyo”, “Kasama mo sa
    court:”): 20px, against 24px for section headings on organizer screens.
- Text colors: ink, muted grey and white on almost every screen; warn (orange), danger (red) and
  success (green) on Live, Pwesto, Bayad and Buod. Live uses 5–6 text colors.
- A muted “eyebrow” line sits above the h1 on Bayad, Buod, Pwesto, Mga court and check-in (session
  name or “Pumila sa open play”) and on Home (greeting); Live uses a LIVE pill + time instead.

### Status wording (same state, different words)
| State | Live | Bayad | Mga court | Pwesto |
| --- | --- | --- | --- | --- |
| Unpaid under pay first | “Hold · bayad muna” chip | “Naka-hold” line | “bayad muna” chip | “Nilalaktawan ka muna…” + “Hindi pa bayad · ₱150” |
| Paused | “Naka-pause” chip | – | “nagpapahinga” chip | “Nagpapahinga ka” |
| Pending GCash | (not marked) | “I-check” chip | (not marked) | “Hinihintay ang kumpirmasyon ng organizer” |
| Not ready | “Hindi pa handa” tile + warning box | – | (not shown) | notice after tapping |

### Navigation (how you move between screens)
- There is no nav bar. Home is the hub: Live (via the LIVE card), “Mga member”, “Settings ng club”
  and “Gabay” are full-width outlined buttons at the bottom of Home, styled like actions.
- Organizer sub-pages have a “Bumalik” link at the top-left. Where it goes:

| From | “Bumalik” goes to | Other ways out |
| --- | --- | --- |
| Live | Home | “Bayad 14/18” tile → Bayad; Walk-in; Ipakita ang QR |
| Bayad | Live | – |
| Walk-in, Session QR | Live | QR: “May permanenteng QR ang club” → Settings |
| Buod (ended session) | Home | “I-check … sa Bayad” → Bayad (only when GCash is pending) |
| Mga member | Home | – |
| Member edit | Mga member | – |
| Settings | Home | “Gabay para sa organizer” |
| Gabay | Home (also when opened from Settings) | – |
| Bagong open play | Home | – |

- From Session QR → “May permanenteng QR ang club” → Settings, “Bumalik” returns to Home, not to the QR
  page.
- Bayad is reached only from the Live stat tile (a card with a chevron, not a button) and from Buod.
- Player screens have no “Bumalik” on Pwesto (it is the player’s home); Mga court has
  “Bumalik sa pwesto ko”; Pwesto → Mga court is an outlined button with a chevron at the bottom.
- Back links all use the same style (chevron + “Bumalik”, 48px). Only Mga court changes the label.

### Things that appear on more than one screen
- “I-print ang QR”: Session QR (outlined) and Settings club QR (filled black).
- “Gabay para sa organizer”: Home and Settings.
- The GCash number: Settings, the new-session form, check-in, Pwesto (held), Buod details.
- Payment totals: Live tile (“14/18”), Bayad card (₱ and counts), Buod card, Home past rows (₱ nakolekta).
