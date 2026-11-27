import type { ReactNode } from "react";
import { callModeLabel, matchmakingLabel, rotationLabel } from "@/lib/club/options";
import { formatPeso } from "@/lib/format";
import { accountLine, methodName, payToFromRow } from "@/lib/payments/method";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Session } from "@/lib/session/data";
import { courtFormatLabel } from "@/lib/session/validation";

/** The session's settings as a grouped list (More › Session details, draft page, summary). */
export function SessionDetails({ session, t, framed = false }: { session: Session; t: Dictionary; framed?: boolean }) {
  const payTo = payToFromRow(session);
  const payment = [methodName(t, payTo), accountLine(payTo)].filter(Boolean).join(" · ");
  return (
    <dl
      role="region"
      aria-label={t.session.details}
      className={framed ? "divide-y divide-hairline overflow-hidden rounded-group bg-surface" : "divide-y divide-hairline"}
    >
      <Row term={t.session.detailCourts}>{t.common.courts(session.courts_count)}</Row>
      <Row term={t.session.detailFormats}>
        {session.court_formats.map((format, index) => `${t.session.courtFormat(index + 1)}: ${courtFormatLabel(format, t)}`).join(" · ")}
      </Row>
      <Row term={t.session.detailPoints}>{t.choices.points(session.points_to)}</Row>
      <Row term={t.session.detailRotation}>{rotationLabel(session.rotation, t)}</Row>
      <Row term={t.session.detailCallMode}>{callModeLabel(session.call_mode, t)}</Row>
      <Row term={t.session.detailMatchmaking}>{matchmakingLabel(session.matchmaking, t)}</Row>
      <Row term={t.session.detailPayFirst}>{session.pay_first ? t.session.yes : t.session.no}</Row>
      <Row term={t.session.detailFee}>{formatPeso(session.fee)}</Row>
      <Row term={t.session.detailPayment}>{payment}</Row>
      <Row term={t.session.detailCash}>{payTo.cashAccepted ? t.session.yes : t.session.no}</Row>
    </dl>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-muted">{term}</dt>
      <dd className="text-right font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
