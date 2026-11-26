/** The printable organizer guide (moved under Settings). */

import { APP_NAME } from "@/lib/brand";

type GuideSection = { title: string; items: string[] };

const en = {
  pageTitle: "Organizer guide",
  title: "Organizer guide",
  subtitle: `${APP_NAME} · one page`,
  print: "Print the guide",
  sections: [
    {
      title: "1. Before the session",
      items: [
        "Print the club QR (Settings › Club QR code › Print QR). One QR works for every session.",
        "Charge your phone and turn the volume up.",
        "Read calls aloud: turn it on for one phone only, so the court doesn't hear it twice.",
      ],
    },
    {
      title: "2. Starting",
      items: [
        "On Home, tap Repeat last to copy the last session, then Start session.",
        "Or tap New session for new settings.",
        "Let players scan the QR. They join the queue on their own phone.",
      ],
    },
    {
      title: "3. During play",
      items: [
        "Courts: Call next 4 on an empty court; Done when a game ends.",
        "Made a mistake? Tap Undo within 30 seconds.",
        "No phone? Walk-in. For regulars, use From members.",
        "Queue: tap a name to pause or remove them.",
        "When a court shows “isn't ready · Swap”, tap it. They go to the front of the queue.",
        "Singles: tap Make singles on an empty court.",
      ],
    },
    {
      title: "4. Payments",
      items: [
        "Open the Payments tab.",
        "GCash: find the reference in your GCash, then Received. Cash: tap Cash.",
        "Not paid yet: tap the bell to send a reminder in Messenger.",
      ],
    },
    {
      title: "5. If something goes wrong",
      items: [
        "A player shows up twice (opened the link in another browser): Queue › tap one › Remove from queue.",
        "Weak signal: keep going. Your taps are saved and sent when the signal returns (“Waiting for signal”). Undo and End session need the internet.",
        "A player's screen turned off: ask them to keep their place-in-line page open to hear the call.",
      ],
    },
    {
      title: "6. After",
      items: [
        "More › End session. The summary shows games per player and payments.",
        "Download (Excel) for a list of every player and payment.",
      ],
    },
  ] as GuideSection[],
};

const fil: typeof en = {
  pageTitle: "Gabay para sa organizer",
  title: "Gabay para sa organizer",
  subtitle: `${APP_NAME} · isang page lang`,
  print: "I-print ang gabay",
  sections: [
    {
      title: "1. Bago ang session",
      items: [
        "I-print ang QR ng club (Settings › QR ng club › I-print ang QR). Iisang QR lang para sa lahat ng session.",
        "I-charge ang phone. Lakasan ang volume.",
        "Tagatawag: i-on sa iisang phone lang, para hindi doble ang boses.",
      ],
    },
    {
      title: "2. Pagsisimula",
      items: [
        "Sa Home, pindutin ang Ulitin ang huli para kopyahin ang huling session, saka Simulan ang session.",
        "O kaya Bagong open play para sa bagong settings.",
        "Ipa-scan ang QR. Pipila ang mga player sa sarili nilang phone.",
      ],
    },
    {
      title: "3. Habang naglalaro",
      items: [
        "Courts: Tawagin ang susunod sa bakanteng court; Tapos na pagkatapos ng laro.",
        "Nagkamali? Pindutin ang Ibalik sa loob ng 30 segundo.",
        "Walang phone ang player? Walk-in. Kung member, gamitin ang Pumili sa members.",
        "Pila: pindutin ang pangalan para mag-pause o mag-alis.",
        "Kapag may “Hindi pa handa · Palitan” sa court, pindutin ito. Babalik siya sa unahan ng pila.",
        "Singles: pindutin ang Gawing Singles sa bakanteng court.",
      ],
    },
    {
      title: "4. Bayad",
      items: [
        "Buksan ang tab na Bayad.",
        "GCash: hanapin ang reference sa GCash mo, saka Natanggap. Cash: pindutin ang Cash.",
        "Hindi pa bayad: pindutin ang kampana para ipadala ang paalala sa Messenger.",
      ],
    },
    {
      title: "5. Kapag may problema",
      items: [
        "Dalawa ang pangalan ng isang player (binuksan ang link sa ibang browser): Pila › pindutin ang isa › Alisin sa pila.",
        "Mahina ang signal: tuloy lang. Ise-save ang mga pinindot mo at ipapadala pagbalik ng signal (“Hinihintay ang signal”). Ang Ibalik at Tapusin ang session ay kailangan ng internet.",
        "Namatay ang screen ng player: sabihan siyang iwanang bukas ang Pwesto sa pila para marinig ang tawag.",
      ],
    },
    {
      title: "6. Pagkatapos",
      items: [
        "Iba pa › Tapusin ang session. Lalabas ang Buod ng session: laro bawat player at bayad.",
        "I-download (Excel) para sa listahan ng lahat ng player at bayad.",
      ],
    },
  ],
};

export const guide = { en, fil };
