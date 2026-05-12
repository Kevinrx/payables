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
    <div className="surface overflow-hidden">
      <div style={{ background: "var(--paper-sunken)" }}>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="block max-h-[600px] w-full object-contain" />
        ) : isPdf ? (
          <object data={url} type="application/pdf" className="block h-[600px] w-full">
            <embed src={url} type="application/pdf" className="block h-[600px] w-full" />
          </object>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-12">
            <FileText className="h-7 w-7" style={{ color: "var(--ink-fainter)" }} />
            <p className="mt-2 text-[13px] font-medium">{name}</p>
            <p className="text-[11.5px] text-ink-faint">Preview not supported.</p>
          </div>
        )}
      </div>
      <div
        className="flex items-center justify-between px-3 py-2 text-[12px]"
        style={{ borderTop: "1px solid var(--rule)" }}
      >
        <span className="truncate text-ink-faint">{name}</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-ink hover:text-brand transition-colors"
        >
          Open
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
