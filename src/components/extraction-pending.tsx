"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle } from "lucide-react";
import { runExtraction } from "@/app/bills/actions";
import { FilePreview } from "./file-preview";

const HINTS = [
  "Reading the document...",
  "Identifying vendor and amounts...",
  "Parsing line items...",
  "Detecting due date...",
  "Almost there...",
];

export function ExtractionPending({
  billId,
  fileUrl,
  fileMime,
  fileName,
}: {
  billId: string;
  fileUrl: string;
  fileMime: string;
  fileName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(0);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    (async () => {
      const res = await runExtraction(billId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    })();
  }, [billId, router]);

  useEffect(() => {
    if (error) return;
    const t = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 2200);
    return () => clearInterval(t);
  }, [error]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <div className="rounded-xl border border-border bg-card p-6">
          {error ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-danger-bg text-danger">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-medium">Extraction failed</h3>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  You can fill in the bill manually, or try uploading again.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-info-bg text-info">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-medium">Extracting with Claude</h3>
                <p className="mt-1 text-sm text-muted-foreground transition-opacity">
                  {HINTS[hint]}
                </p>
                <div className="mt-4 space-y-2">
                  <SkeletonRow w="60%" />
                  <SkeletonRow w="40%" />
                  <SkeletonRow w="80%" />
                  <SkeletonRow w="55%" />
                </div>
              </div>
            </div>
          )}
        </div>

        <SkeletonSection />
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium tracking-tight">Original document</h2>
          </div>
          <div className="p-3">
            <FilePreview url={fileUrl} mime={fileMime} name={fileName} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow({ w }: { w: string }) {
  return (
    <div
      className="h-3 rounded bg-muted animate-pulse"
      style={{ width: w }}
    />
  );
}

function SkeletonSection() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="space-y-3">
        <SkeletonRow w="30%" />
        <SkeletonRow w="100%" />
        <SkeletonRow w="90%" />
        <SkeletonRow w="70%" />
      </div>
    </div>
  );
}
