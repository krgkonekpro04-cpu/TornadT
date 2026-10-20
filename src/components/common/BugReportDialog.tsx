import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bug, ImagePlus, LoaderCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 9 * 1024 * 1024;
const inputClass = "h-10 w-full rounded-lg border border-tt-border bg-tt-bg2 px-3 text-sm text-tt-text placeholder:text-tt-muted focus:border-tt-accent/70 focus:outline-none";

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export function BugReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [recipient, setRecipient] = useState("krg.konekpro04@gmail.com");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true);
    fetch("/bug-report/settings", { headers: { Accept: "application/json" } })
      .then(async response => {
        const settings = await response.json() as { recipient?: string };
        if (!response.ok) throw new Error("Could not load report settings.");
        if (current && settings.recipient) setRecipient(settings.recipient);
      })
      .catch(() => { if (current) toast.error("Could not load the saved report email."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [open]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setFiles([]);
    setSent(false);
    setSending(false);
  };

  const changeOpen = (next: boolean) => {
    if (!next && sending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next = [...files];
    for (const file of Array.from(picked)) {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} is not an image.`); continue; }
      if (file.size > MAX_FILE_BYTES) { toast.error(`${file.name} is larger than 8 MB.`); continue; }
      if (next.length >= MAX_FILES) { toast.error(`Attach up to ${MAX_FILES} photos.`); break; }
      if ([...next, file].reduce((sum, item) => sum + item.size, 0) > MAX_TOTAL_BYTES) {
        toast.error("All attachments together must be 9 MB or smaller.");
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipient.trim() || !title.trim() || !description.trim()) return;
    setSending(true);
    try {
      const attachments = await Promise.all(files.map(async file => ({ name: file.name, type: file.type, data: await fileAsDataUrl(file) })));
      const response = await fetch("/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          recipient: recipient.trim(), title: title.trim(), description: description.trim(),
          page: `${window.location.origin}${window.location.pathname}`,
          platform: navigator.platform, appVersion: "2.0.0", userAgent: navigator.userAgent, attachments,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not send the report.");
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the report.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-tt-border bg-tt-bg2 text-tt-text sm:max-w-xl">
        {loading ? (
          <div className="flex items-center gap-2 py-5 text-sm text-tt-muted"><LoaderCircle className="size-4 animate-spin" /> Loading report form…</div>
        ) : sent ? (
          <div className="space-y-4 py-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Send className="size-5" /></div>
            <div>
              <DialogTitle className="text-lg">Report submitted</DialogTitle>
              <DialogDescription className="mt-2 text-tt-muted">The relay accepted your report for {recipient}. If this is the first report to this email, check your inbox for FormSubmit’s confirmation email and confirm the address to enable delivery.</DialogDescription>
            </div>
            <button type="button" onClick={() => changeOpen(false)} className="h-9 rounded-lg bg-tt-accent2 px-4 text-sm text-white hover:bg-tt-accent">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-start gap-3 pr-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-tt-accent/10 text-tt-lilac"><Bug className="size-5" /></div>
              <div>
                <DialogTitle className="text-lg">Report a bug</DialogTitle>
                <DialogDescription className="mt-1 text-tt-muted">Enter the email address where you want TornadT to send the report.</DialogDescription>
              </div>
            </div>
            <label className="block space-y-1.5">
              <span className="tt-label !text-[10px]">Your email</span>
              <input type="email" required maxLength={254} value={recipient} onChange={e => setRecipient(e.target.value)} className={inputClass} placeholder="you@example.com" autoComplete="email" />
            </label>
            <label className="block space-y-1.5">
              <span className="tt-label !text-[10px]">Short summary</span>
              <input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="What happened?" />
            </label>
            <label className="block space-y-1.5">
              <span className="tt-label !text-[10px]">Details</span>
              <textarea required maxLength={8000} rows={5} value={description} onChange={e => setDescription(e.target.value)} className="w-full resize-y rounded-lg border border-tt-border bg-tt-bg2 px-3 py-2 text-sm text-tt-text placeholder:text-tt-muted focus:border-tt-accent/70 focus:outline-none" placeholder="Steps to reproduce, what you expected, and what happened instead…" />
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="tt-label !text-[10px]">Photos (optional)</span>
                <span className="text-[10px] text-tt-muted">Up to 5 · 8 MB each · 9 MB total</span>
              </div>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple className="sr-only" onChange={e => addFiles(e.currentTarget.files)} />
              <button type="button" onClick={() => fileInput.current?.click()} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-tt-border text-sm text-tt-muted hover:border-tt-accent/60 hover:text-white"><ImagePlus className="size-4" /> Add photos</button>
              {files.length > 0 && <ul className="space-y-1.5">
                {files.map((file, i) => <li key={`${file.name}-${file.lastModified}-${i}`} className="flex items-center gap-2 rounded-md bg-tt-bg px-2.5 py-1.5 text-xs">
                  <ImagePlus className="size-3.5 shrink-0 text-tt-cyan" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="text-tt-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, index) => index !== i))} className="rounded p-1 text-tt-muted hover:text-white"><X className="size-3.5" /></button>
                </li>)}
              </ul>}
            </div>
            <p className="text-[11px] leading-relaxed text-tt-muted">Reports and photos are sent through FormSubmit, which processes the submission before forwarding it by email. Avoid including passwords or other sensitive information. First use requires confirming the address from FormSubmit’s email.</p>
            <div className="flex justify-end gap-2 border-t border-tt-border pt-3">
              <button type="button" disabled={sending} onClick={() => changeOpen(false)} className="h-9 rounded-lg border border-tt-border px-4 text-sm text-tt-muted hover:text-white disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={sending || !recipient.trim() || !title.trim() || !description.trim()} className="flex h-9 items-center gap-2 rounded-lg bg-tt-accent2 px-4 text-sm text-white hover:bg-tt-accent disabled:cursor-not-allowed disabled:opacity-50"><Send className="size-3.5" /> {sending ? "Sending…" : "Send report"}</button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
