import { Button, IconLink } from "@/components/ui";
import { PlusIcon, QrIcon } from "@/components/ui/icons";
import { rotationLabel } from "@/lib/club/options";
import type { Dictionary } from "@/lib/i18n/dictionary";

/** Courts / Queue top row: QR icon button and "+ Walk-in" pill. */
export function LiveHeaderActions({ sessionId, t }: { sessionId: string; t: Dictionary }) {
  return (
    <>
      <IconLink href={`/s/${sessionId}/qr`} label={t.live.showQr}>
        <QrIcon className="size-[18px]" />
      </IconLink>
      <Button href={`/s/${sessionId}/walk-in`} size="pill" className="h-10 px-4 font-medium">
        <PlusIcon className="size-4" />
        {t.live.walkIn}
      </Button>
    </>
  );
}

/** "● Live · All off · 10 playing · 8 in queue": the rotation is always visible while live. */
export function LiveLine({ rotation, playing, waiting, t }: { rotation: string; playing: number; waiting: number; t: Dictionary }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className="size-[7px] rounded-full bg-live" />
      {t.live.liveLine(rotationLabel(rotation, t), playing, waiting)}
    </span>
  );
}
