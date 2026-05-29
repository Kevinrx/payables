import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDemoOrgId, listAllocationTemplates } from "@/db/queries";
import { canManageTemplates } from "@/lib/permissions";
import {
  AllocationTemplatesList,
  type AllocationTemplateRow,
} from "@/components/allocation-templates-list";

export const dynamic = "force-dynamic";

export default async function AllocationTemplatesPage() {
  const orgId = await getDemoOrgId();
  const templateRows = await listAllocationTemplates(orgId);
  const canManage = canManageTemplates(orgId);

  const rows: AllocationTemplateRow[] = templateRows.map((t) => ({
    id: t.id,
    name: t.name,
    splits: t.splits,
  }));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-7">
      <Link href="/settings" className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-3 w-3" />
        Back to settings
      </Link>

      <div className="mt-3">
        <span className="micro">Settings</span>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Allocation templates</h1>
        <p className="mt-1.5 max-w-xl text-[13.5px] text-ink-faint">
          Reusable split configurations you can apply to any line item.
        </p>
      </div>

      <AllocationTemplatesList rows={rows} canManage={canManage} />
    </div>
  );
}
