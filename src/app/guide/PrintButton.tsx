"use client";

import { Button } from "@/components/ui";
import { PrinterIcon } from "@/components/ui/icons";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button fullWidth className="print:hidden" onClick={() => window.print()}>
      <PrinterIcon className="size-[18px]" />
      {label}
    </Button>
  );
}
