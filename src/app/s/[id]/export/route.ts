import { getAuthUser } from "@/lib/auth/dal";
import { getT } from "@/lib/i18n/server";
import { payToFromRow } from "@/lib/payments/method";
import { getSession } from "@/lib/session/data";
import { getSummaryData } from "@/lib/summary/data";
import { summaryCsv, summaryFileName } from "@/lib/summary/summary";

/**
 * Download (Excel): the session as CSV (UTF-8 with BOM), in the device's
 * language. Live or ended (the Payments tab has a download button, D19);
 * staff of the session's club only (RLS), others get 404 like the page.
 */
export async function GET(_request: Request, { params }: RouteContext<"/s/[id]/export">) {
  const { id } = await params;
  if (!(await getAuthUser())) return new Response("Not found", { status: 404 });
  const session = await getSession(id);
  if (!session || session.status === "draft") return new Response("Not found", { status: 404 });

  const [{ players }, t] = await Promise.all([getSummaryData(session.id), getT()]);
  const fileName = summaryFileName(session.name, session.started_at ?? session.starts_at, t);
  return new Response(summaryCsv(players, session.fee, payToFromRow(session), t), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
