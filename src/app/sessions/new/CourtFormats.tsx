"use client";

import { RadioGroup } from "@/components/ui";
import { AlertIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import { courtFormatChoices, type CourtFormat } from "@/lib/session/validation";

type Props = {
  count: number;
  /** One entry per court ever shown; only the first `count` are rendered. */
  formats: CourtFormat[];
  onChange: (index: number, format: CourtFormat) => void;
  error?: string;
};

/**
 * One Doubles / Singles switch per court. Fewer courts hide the extra rows but
 * keep their choices; more courts add Doubles rows.
 */
export function CourtFormats({ count, formats, onChange, error }: Props) {
  const t = useT();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-1.5 text-sm font-medium text-secondary">{t.session.courtFormatsLegend}</legend>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <RadioGroup
            className="flex-1"
            legend={t.session.courtFormat(index + 1)}
            name={`court_format_${index + 1}`}
            look="segmented"
            options={courtFormatChoices(t)}
            defaultValue={formats[index] ?? "doubles"}
            onValueChange={(format) => onChange(index, format)}
          />
        </div>
      ))}
      {error && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertIcon className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
