"use client";

import { RadioGroup } from "@/components/ui";
import { AlertIcon } from "@/components/ui/icons";
import { COURT_FORMAT_CHOICES, type CourtFormat } from "@/lib/session/validation";

type Props = {
  count: number;
  /** One entry per court ever shown; only the first `count` are rendered. */
  formats: CourtFormat[];
  onChange: (index: number, format: CourtFormat) => void;
  error?: string;
};

/**
 * One Doubles / Singles choice per court. Fewer courts hide the extra rows but
 * keep their choices; more courts add Doubles rows.
 */
export function CourtFormats({ count, formats, onChange, error }: Props) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-1.5 text-body font-semibold text-ink">Doubles o Singles?</legend>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} onChange={(event) => onChange(index, (event.target as HTMLInputElement).value as CourtFormat)}>
          <RadioGroup
            legend={`Court ${index + 1}`}
            name={`court_format_${index + 1}`}
            layout="row"
            options={COURT_FORMAT_CHOICES}
            defaultValue={formats[index] ?? "doubles"}
          />
        </div>
      ))}
      {error && (
        <p className="flex items-start gap-1.5 text-base font-medium text-danger">
          <AlertIcon className="mt-0.5 size-[18px] shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
