import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  BackLink,
  Button,
  Card,
  Input,
  Notice,
  PageShell,
  RadioGroup,
  StatusLabel,
  type ButtonVariant,
  type StatusKind,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Design System · Open Play Queue",
};

const VARIANTS: { variant: ButtonVariant; label: string }[] = [
  { variant: "primary", label: "Sumali sa pila" },
  { variant: "secondary", label: "Tingnan ang pila" },
  { variant: "accent", label: "Simulan ang laro" },
  { variant: "danger-outline", label: "Tanggalin sa pila" },
];

const STATUSES: StatusKind[] = ["paid", "pending", "hold", "playing"];

const SWATCHES: { name: string; className: string; hex: string }[] = [
  { name: "page", className: "bg-page", hex: "#F6F6F3" },
  { name: "surface", className: "bg-surface", hex: "#FFFFFF" },
  { name: "subtle", className: "bg-subtle", hex: "#F2F2EE" },
  { name: "primary", className: "bg-primary", hex: "#111412" },
  { name: "primary-tint", className: "bg-primary-tint", hex: "#F3F6EA" },
  { name: "accent", className: "bg-accent", hex: "#C9F26B" },
  { name: "accent-soft", className: "bg-accent-soft", hex: "#F1F9DC" },
  { name: "success", className: "bg-success", hex: "#EEF5E4" },
  { name: "warn", className: "bg-warn", hex: "#FBEEDC" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `ds-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <PageShell
      header={
        <div className="flex flex-col gap-1">
          <BackLink href="/" />
          <h1 className="text-3xl">Design System</h1>
          <p className="text-muted">Ink &amp; Lime · lahat ng base components, isang pahina.</p>
        </div>
      }
      footer={
        <Button fullWidth size="lg" variant="accent">
          Mag-check in na
        </Button>
      }
    >
      <div className="flex flex-col gap-10">
        <Section title="Colors">
          <ul className="grid grid-cols-3 gap-3">
            {SWATCHES.map((s) => (
              <li key={s.name} className="flex flex-col gap-1">
                <span className={`h-14 rounded-control border border-default ${s.className}`} />
                <span className="text-base font-semibold">{s.name}</span>
                <span className="text-base text-muted">{s.hex}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Typography">
          <Card className="flex flex-col gap-2">
            <p className="font-display text-4xl font-bold tracking-[-0.02em]">Court 3</p>
            <h3 className="text-xl">Space Grotesk · headings</h3>
            <p>Inter · body 17px. Hintayin ang tawag bago pumasok sa court.</p>
            <p className="text-muted">Muted · Huling laro: 7:42 PM</p>
          </Card>
        </Section>

        <Section title="Button · md (48px)">
          <div className="flex flex-col gap-3">
            {VARIANTS.map(({ variant, label }) => (
              <Button key={variant} variant={variant}>
                {label}
              </Button>
            ))}
          </div>
        </Section>

        <Section title="Button · lg (56px), fullWidth">
          <div className="flex flex-col gap-3">
            {VARIANTS.map(({ variant, label }) => (
              <Button key={variant} variant={variant} size="lg" fullWidth>
                {label}
              </Button>
            ))}
          </div>
        </Section>

        <Section title="Button · link & disabled">
          <div className="flex flex-col gap-3">
            <Button href="/" variant="secondary" fullWidth>
              Pumunta sa home (link)
            </Button>
            <Button disabled fullWidth>
              Puno na ang pila
            </Button>
          </div>
        </Section>

        <Section title="StatusLabel">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((kind) => (
              <StatusLabel key={kind} kind={kind} />
            ))}
          </div>
        </Section>

        <Section title="Card">
          <Card className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl">Tito Boy</h3>
                <p className="text-muted">Pang-3 sa pila</p>
              </div>
              <StatusLabel kind="paid" />
            </div>
            <Button variant="secondary" fullWidth>
              I-check ang bayad
            </Button>
          </Card>
          <Card className="flex flex-col gap-1 bg-primary-tint">
            <h3 className="text-xl">Court 1</h3>
            <p className="text-muted">Naglalaro: Tita Mel, Jun, Ana, Paolo</p>
          </Card>
        </Section>

        <Section title="Input">
          <Card className="flex flex-col gap-5">
            <Input label="Pangalan mo" placeholder="hal. Tito Boy" autoComplete="name" />
            <Input
              label="Mobile number"
              hint="Para ma-text ka kapag ikaw na ang susunod."
              inputMode="tel"
              placeholder="0917 123 4567"
            />
            <Input
              label="Palayaw sa court"
              error="Pakilagay ang palayaw mo."
            />
            <Input label="Club" defaultValue="Makati Picklers" disabled />
          </Card>
        </Section>

        <Section title="RadioGroup">
          <Card className="flex flex-col gap-5">
            <RadioGroup
              legend="Points bawat laro"
              name="ds-points"
              layout="row"
              defaultValue="11"
              options={[
                { value: "11", label: "11" },
                { value: "15", label: "15" },
                { value: "21", label: "21" },
              ]}
            />
            <RadioGroup
              legend="Rotation"
              name="ds-rotation"
              defaultValue="all_off"
              options={[
                {
                  value: "all_off",
                  label: "Lahat ng apat aalis",
                  description: "Pagkatapos ng laro, babalik sa pila ang apat na naglaro.",
                },
                {
                  value: "winners_stay",
                  label: "Mananatili ang nanalo",
                  description: "Maglalaro ulit ang nanalong pares laban sa susunod.",
                },
              ]}
            />
            <RadioGroup
              legend="Laki ng court"
              name="ds-error"
              error="Pumili ng isa."
              options={[
                { value: "a", label: "Isang court" },
                { value: "b", label: "Dalawang court" },
              ]}
            />
            <RadioGroup
              legend="Disabled (read-only)"
              name="ds-disabled"
              disabled
              defaultValue="x"
              options={[
                { value: "x", label: "Hindi mapalitan" },
                { value: "y", label: "Ibang option" },
              ]}
            />
          </Card>
        </Section>

        <Section title="Notice">
          <div className="flex flex-col gap-3">
            <Notice kind="success">Na-save na.</Notice>
            <Notice kind="error">Hindi maipadala ang login link ngayon. Subukan ang Google sign-in.</Notice>
            <Notice kind="info">Ang owner lang ang pwedeng magbago nito.</Notice>
          </div>
        </Section>

        <Section title="BackLink">
          <Card>
            <BackLink href="/" />
          </Card>
        </Section>

        <Section title="PageShell">
          <p className="text-muted">
            Ang pahinang ito mismo: header, body na nag-i-scroll, at sticky footer sa ibaba. Max 430px
            ang lapad, naka-gitna sa malapad na screen.
          </p>
        </Section>
      </div>
    </PageShell>
  );
}
