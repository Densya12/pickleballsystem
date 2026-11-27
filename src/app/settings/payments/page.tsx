import { redirect } from "next/navigation";

/** The old "GCash and fee" page: payment is now a section of Club details. */
export default function Page() {
  redirect("/settings/club#payment");
}
