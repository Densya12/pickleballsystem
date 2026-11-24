"use client";

import { Button } from "@/components/ui";
import { PrinterIcon } from "@/components/ui/icons";

export function PrintButton() {
  return (
    <Button variant="secondary" fullWidth className="print:hidden" onClick={() => window.print()}>
      <PrinterIcon />
      I-print ang gabay
    </Button>
  );
}
