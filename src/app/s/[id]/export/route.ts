import { getAuthUser } from "@/lib/auth/dal";
import { getSession } from "@/lib/session/data";
import { getSummaryData } from "@/lib/summary/data";
import { summaryCsv, summaryFileName } from "@/lib/summary/summary";

/**
 * "I-download (Excel)": the ended session as CSV (UTF-8 with BOM). Staff of
 * the session's club only (RLS); others get 404, like the page.
 */
export async function GET(_request: Request, { params }: RouteContext<"/s/[id]/export">) {
  const { id } = await params;
  if (!(await getAuthUser())) return new Response("Hindi makita.", { status: 404 });
  const session = await getSession(id);
  if (!session || session.status !== "ended") return new Response("Hindi makita.", { status: 404 });

  const { players } = await getSummaryData(session.id);
  const fileName = summaryFileName(session.name, session.started_at ?? session.starts_at);
  return new Response(summaryCsv(players, session.fee), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
