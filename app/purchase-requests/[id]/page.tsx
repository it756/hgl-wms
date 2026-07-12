import { redirect } from "next/navigation";

/**
 * PR details are shown in a dialog on the list page.
 * Redirect so that direct-URL access still lands somewhere useful.
 */
export default async function PurchaseRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/purchase-requests?view=${id}`);
}
