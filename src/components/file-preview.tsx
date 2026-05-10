import { ExternalLink, FileText } from "lucide-react";

export function FilePreview({
  url,
  mime,
  name,
}: {
  url: string;
  mime: string;
  name: string;
}) {
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="block max-h-[600px] w-full object-contain" />
      ) : isPdf ? (
        <object data={url} type="application/pdf" className="block h-[600px] w-full">
          <embed src={url} type="application/pdf" className="block h-[600px] w-full" />
        </object>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-10">
          <FileText className="h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">Preview not supported.</p>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border bg-card px-3 py-2 text-xs">
        <span className="truncate text-muted-foreground">{name}</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
        >
          Open
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
