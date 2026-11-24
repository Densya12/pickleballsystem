import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Gabay para sa organizer · Open Play Queue",
};

/** One printable page for the pilot organizer, in Taglish, with big text. */
export default function GuidePage() {
  return (
    <PageShell
      className="print:bg-surface"
      header={
        <div className="flex flex-col gap-1">
          <BackLink href="/" className="print:hidden" />
          <h1 className="text-4xl">Gabay para sa organizer</h1>
          <p className="text-xl text-muted">Open Play Queue · isang page lang</p>
        </div>
      }
    >
      <div className="flex flex-col gap-7 text-xl leading-relaxed print:gap-4 print:text-base">
        <PrintButton />

        <Section title="1. Bago ang session">
          <li>I-print ang QR ng club (Settings ng club → QR ng club → I-print ang QR). Iisang QR lang para sa lahat ng session.</li>
          <li>I-charge ang phone. Lakasan ang volume.</li>
          <li>Tagatawag: i-on sa iisang phone lang, para hindi doble ang boses.</li>
        </Section>

        <Section title="2. Pagsisimula">
          <li>
            Sa Home, pindutin ang <B>Ulitin: …</B> para ulitin ang huling session, saka <B>Simulan ang session</B>.
          </li>
          <li>
            O kaya <B>Bagong open play</B> para sa bagong settings.
          </li>
          <li>Ipa-scan ang QR. Pipila ang mga player sa sarili nilang phone.</li>
        </Section>

        <Section title="3. Habang naglalaro">
          <li>
            <B>Tawagin ang susunod</B> para sa bakanteng court. <B>Tapos na · tawagin ang susunod</B> pagkatapos ng laro.
          </li>
          <li>
            Nagkamali? Pindutin ang <B>Ibalik</B> sa loob ng 30 segundo.
          </li>
          <li>
            Walang phone ang player? <B>Walk-in</B>. Kung member, gamitin ang <B>Pumili sa members</B>.
          </li>
          <li>Pindutin ang pangalan sa pila para mag-pause o mag-alis.</li>
          <li>
            Kapag may &quot;Hindi pa handa&quot; sa court, pindutin ang <B>Palitan</B>. Babalik siya sa unahan ng pila.
          </li>
          <li>
            Singles: pindutin ang <B>Gawing Singles</B> sa bakanteng court.
          </li>
        </Section>

        <Section title="4. Bayad">
          <li>
            Buksan ang <B>Bayad</B> sa Live screen.
          </li>
          <li>
            GCash: hanapin ang reference sa GCash mo, saka <B>Natanggap na</B>. Cash: <B>Natanggap na (cash)</B>.
          </li>
          <li>
            Hindi pa bayad: <B>Paalalahanan</B> para ipadala ang paalala sa Messenger.
          </li>
        </Section>

        <Section title="5. Kapag may problema">
          <li>
            Dalawa ang pangalan ng isang player (binuksan ang link sa ibang browser): pindutin ang isa sa pila, saka{" "}
            <B>Alisin sa pila</B>.
          </li>
          <li>
            Mahina ang signal: tuloy lang. Ise-save ang mga pinindot mo at ipapadala pagbalik ng signal (&quot;Hinihintay
            ang signal&quot;). Ang Ibalik at Tapusin ang session ay kailangan ng internet.
          </li>
          <li>Namatay ang screen ng player: sabihan siyang iwanang bukas ang Pwesto sa pila para marinig ang tawag.</li>
        </Section>

        <Section title="6. Pagkatapos">
          <li>
            <B>Tapusin ang session</B>. Lalabas ang <B>Buod ng session</B>: laro bawat player at bayad.
          </li>
          <li>
            <B>I-download (Excel)</B> para sa listahan ng lahat ng player at bayad.
          </li>
        </Section>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 break-inside-avoid">
      <h2 className="text-2xl print:text-xl">{title}</h2>
      <ul className="flex list-disc flex-col gap-2 pl-7 print:gap-1">{children}</ul>
    </section>
  );
}

function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold">{children}</strong>;
}
