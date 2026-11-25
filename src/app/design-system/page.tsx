import type { Metadata } from "next";
import { MiniCourt } from "@/components/court/MiniCourt";
import {
  BackLink,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  ListGroup,
  ListRow,
  Notice,
  PageShell,
  RadioGroup,
  RowText,
  Section,
  StatusChip,
  Stepper,
  Toggle,
} from "@/components/ui";
import {
  Skeleton,
  SkeletonCard,
  SkeletonCircle,
  SkeletonCourt,
  SkeletonField,
  SkeletonLine,
  SkeletonRegion,
} from "@/components/ui";
import { BellIcon, PlusIcon, QrIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Design System · Open Play Queue",
};

/** Developer reference for the v5 "Clean 2026" components (D19). Not linked from the app. */
export default function DesignSystemPage() {
  return (
    <PageShell
      top={<BackLink href="/" label="Home" />}
      eyebrow="Ink & Lime · v5"
      title="Design System"
      footer={<Button fullWidth>Main button</Button>}
    >
      <div className="flex flex-col gap-6">
        <Section id="buttons" label="Buttons">
          <Card className="flex flex-wrap items-center gap-2">
            <Button size="pill">Ink pill</Button>
            <Button variant="lime" size="pill">
              Done
            </Button>
            <Button variant="lime" size="sm">
              Received
            </Button>
            <Button variant="outline" size="sm">
              Cash
            </Button>
            <Button variant="secondary" size="md">
              <PlusIcon className="size-4" />
              New session
            </Button>
            <Button variant="danger" size="md">
              Leave queue
            </Button>
            <IconButton label="Show QR" look="outline">
              <QrIcon className="size-[18px]" />
            </IconButton>
            <IconButton label="Remind" look="outline" size="sm">
              <BellIcon className="size-4" />
            </IconButton>
          </Card>
        </Section>

        <Section id="status" label="Status">
          <Card className="flex flex-wrap gap-2">
            {(["unpaid", "resting", "notReady", "toCheck", "paid", "playing", "live", "draft", "ended"] as const).map((kind) => (
              <StatusChip key={kind} kind={kind} />
            ))}
          </Card>
        </Section>

        <Section id="notices" label="Notices">
          <div className="flex flex-col gap-2">
            <Notice kind="success">Saved.</Notice>
            <Notice kind="warning">Offline — will save when signal returns</Notice>
            <Notice kind="error">Something went wrong. Try again.</Notice>
            <Notice kind="info">This is a draft.</Notice>
          </div>
        </Section>

        <Section id="lists" label="Grouped list">
          <ListGroup>
            <ListRow href="/design-system">
              <RowText title="Club details" detail="Pasig Pickleball" />
            </ListRow>
            <ListRow trailing={<StatusChip kind="unpaid" />}>
              <RowText title="Mika Torres" detail="Must pay before being called" detailTone="warn" />
            </ListRow>
          </ListGroup>
          <EmptyState>Nothing scheduled. Tap New session to plan one.</EmptyState>
        </Section>

        <Section id="forms" label="Forms">
          <Card className="flex flex-col gap-4">
            <Input label="Name" placeholder="e.g. Tito Boy" />
            <Input label="City" labelNote="(optional)" error="Up to 60 characters." />
            <RadioGroup legend="Level" name="level" look="chips" defaultValue="intermediate" options={[
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
            ]} />
            <RadioGroup legend="Payment method" name="method" look="segmented" defaultValue="gcash" options={[
              { value: "gcash", label: "GCash" },
              { value: "cash", label: "Cash" },
            ]} />
            <RadioGroup legend="After each game" name="rotation" defaultValue="all_off" options={[
              { value: "all_off", label: "All off", description: "All four go to the back of the queue" },
              { value: "winners_stay", label: "Winners stay", description: "Up to 2 games in a row" },
            ]} />
            <Stepper label="Courts" name="courts" min={1} max={8} defaultValue={3} decrementLabel="Fewer courts" incrementLabel="More courts" />
            <Toggle label="Pay before queueing" description="Unpaid players are skipped" defaultChecked />
          </Card>
        </Section>

        <Section id="court" label="Mini court">
          <Card className="flex flex-col gap-2">
            <MiniCourt format="doubles" players={[
              { id: "1", name: "Dino Reyes" },
              { id: "2", name: "Carlo Mendoza" },
              { id: "3", name: "Bong Santos" },
              { id: "4", name: "Fe Castillo", notReady: true },
            ]} />
            <MiniCourt format="singles" players={[{ id: "5", name: "Hector Cruz", highlight: true }, { id: "6", name: "Ivy Bautista" }]} />
          </Card>
        </Section>

        <Section id="skeleton" label="Skeleton (loading)">
          <SkeletonRegion className="flex flex-col gap-3">
            <div className="flex items-center gap-3 px-1">
              <SkeletonCircle size={26} />
              <span className="flex-1">
                <SkeletonLine width="55%" />
                <SkeletonLine size="sm" width="35%" />
              </span>
              <Skeleton width={86} height={40} rounded="full" />
            </div>
            <SkeletonCard padding="p-3.5" className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <SkeletonLine size="lg" width={68} />
                <SkeletonLine size="xs" width={96} />
              </div>
              <SkeletonCourt />
            </SkeletonCard>
            <SkeletonCard>
              <SkeletonField />
            </SkeletonCard>
          </SkeletonRegion>
        </Section>
      </div>
    </PageShell>
  );
}
