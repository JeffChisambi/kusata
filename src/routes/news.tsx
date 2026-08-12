import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Newspaper, Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X, Star,
  AlertTriangle, ImageIcon, Check,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import { requireSuperAdmin } from "@/lib/auth";
import {
  useNewsList, useCreateNews, useUpdateNews, useDeleteNews, uploadNewsImage,
  type NewsArticle, type NewsInput,
} from "@/hooks/useNewsAdmin";

export const Route = createFileRoute("/news")({
  head: () => ({ meta: [{ title: "News — Pine Broker Admin" }] }),
  beforeLoad: () => requireSuperAdmin(),
  component: NewsAdminPage,
});

const CATEGORY_SUGGESTIONS = ["Banking", "Markets", "Insurance", "Economy", "Companies"];

/* Body <-> paragraphs: blank-line separated in the editor, array in the API. */
const bodyToText = (body: string[]) => body.join("\n\n");
const textToBody = (text: string) =>
  text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function NewsAdminPage() {
  const { data, isLoading, isError } = useNewsList();
  const del = useDeleteNews();
  const update = useUpdateNews();

  const [editing, setEditing] = useState<NewsArticle | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<NewsArticle | null>(null);

  const articles = data?.articles ?? [];

  const togglePublish = (a: NewsArticle) =>
    update.mutate({ id: a.id, input: { isPublished: !a.isPublished } });

  return (
    <div className="pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[3px] bg-pine/10 text-pine flex items-center justify-center">
          <Newspaper className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">News</h1>
          <p className="text-xs text-muted-foreground">
            Publish articles to the mobile app's News tab.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New article
        </button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-rose flex flex-col items-center gap-2">
            <AlertTriangle className="w-6 h-6" /> Failed to load news.
          </div>
        ) : articles.length === 0 ? (
          <div className="py-20 text-center">
            <Newspaper className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No articles yet.</p>
            <button onClick={() => setCreating(true)} className="mt-3 text-sm text-pine font-medium">
              Create the first one
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <th className="pl-5 py-2.5 text-left font-medium">Article</th>
                  <th className="py-2.5 text-left font-medium">Category</th>
                  <th className="py-2.5 text-left font-medium">Status</th>
                  <th className="py-2.5 text-left font-medium">Published</th>
                  <th className="pr-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-muted/20">
                    <td className="pl-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-[4px] bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                          {a.imageUrl ? (
                            <img src={a.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-[13px] truncate max-w-[360px] flex items-center gap-1.5">
                            {a.featured && <Star className="w-3 h-3 text-amber fill-amber shrink-0" />}
                            {a.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[360px]">{a.source}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-[12px] text-muted-foreground">{a.category}</td>
                    <td className="py-3">
                      {a.isPublished ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-pine/10 text-pine">
                          <span className="w-1.5 h-1.5 rounded-full bg-pine" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(a.publishedAt)}</td>
                    <td className="pr-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title={a.isPublished ? "Unpublish" : "Publish"} onClick={() => togglePublish(a)}>
                          {a.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </IconBtn>
                        <IconBtn title="Edit" onClick={() => setEditing(a)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </IconBtn>
                        <IconBtn title="Delete" tone="rose" onClick={() => setConfirmDelete(a)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <NewsEditor
          article={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}

      {confirmDelete && (
        <Modal title="Delete article" onClose={() => setConfirmDelete(null)}>
          <p className="text-xs text-muted-foreground mb-4">
            Delete <strong>{confirmDelete.title}</strong>? This removes it from the mobile app and can't be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40">Cancel</button>
            <button
              onClick={() => del.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })}
              disabled={del.isPending}
              className="h-8 px-4 rounded-[3px] bg-rose text-white text-xs font-medium hover:bg-rose/90 flex items-center gap-1.5 disabled:opacity-50"
            >
              {del.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Editor modal ── */
function NewsEditor({ article, onClose }: { article: NewsArticle | null; onClose: () => void }) {
  const create = useCreateNews();
  const update = useUpdateNews();
  const isEdit = !!article;

  const [category, setCategory] = useState(article?.category ?? "Markets");
  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [bodyText, setBodyText] = useState(article ? bodyToText(article.body) : "");
  const [source, setSource] = useState(article?.source ?? "");
  const [imageUrl, setImageUrl] = useState(article?.imageUrl ?? "");
  const [featured, setFeatured] = useState(article?.featured ?? false);
  const [isPublished, setIsPublished] = useState(article?.isPublished ?? true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { imageUrl: url } = await uploadNewsImage(file);
      setImageUrl(url);
    } catch (e: any) {
      setError(e?.message ?? "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const body = useMemo(() => textToBody(bodyText), [bodyText]);
  const canSave = title.trim() && source.trim() && body.length > 0;
  const pending = create.isPending || update.isPending;

  const save = () => {
    if (!canSave) { setError("Title, source and at least one body paragraph are required."); return; }
    setError(null);
    const input: NewsInput = {
      category: category.trim() || "Markets",
      title: title.trim(),
      summary: summary.trim() || undefined,
      body,
      source: source.trim(),
      imageUrl: imageUrl.trim() || undefined,
      featured,
      isPublished,
    };
    const onDone = { onSuccess: () => onClose(), onError: (e: any) => setError(e?.message ?? "Save failed.") };
    if (isEdit && article) update.mutate({ id: article.id, input }, onDone);
    else create.mutate(input, onDone);
  };

  const previewTime = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-4xl my-4 mx-4 bg-background rounded-[4px] border border-border shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="font-semibold text-[15px]">{isEdit ? "Edit article" : "New article"}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-[3px] hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_320px]">
          {/* Form */}
          <div className="p-5 space-y-4 min-w-0">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <input list="news-cats" value={category} onChange={(e) => setCategory(e.target.value)}
                  className="form-input" placeholder="e.g. Banking" />
                <datalist id="news-cats">
                  {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="Source / byline">
                <input value={source} onChange={(e) => setSource(e.target.value)} className="form-input" placeholder="e.g. FDH Bank Plc" />
              </Field>
            </div>

            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" placeholder="Headline shown on the card" />
            </Field>

            <Field label="Summary (optional)">
              <input value={summary} onChange={(e) => setSummary(e.target.value)} className="form-input" placeholder="One-line teaser" />
            </Field>

            <Field label="Hero image (optional)">
              <div className="flex items-center gap-2">
                <label className={`h-[38px] px-3 rounded-[3px] border border-border text-sm flex items-center gap-1.5 cursor-pointer hover:bg-muted/40 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  {uploading ? "Uploading…" : "Upload image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleImageFile(e.target.files?.[0])}
                  />
                </label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="form-input flex-1"
                  placeholder="…or paste an image URL"
                />
              </div>
            </Field>

            <Field label="Body — separate paragraphs with a blank line">
              <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={10}
                className="form-input resize-y font-normal leading-relaxed"
                placeholder={"First paragraph…\n\nSecond paragraph…"} />
              <div className="text-[11px] text-muted-foreground mt-1">{body.length} paragraph{body.length === 1 ? "" : "s"}</div>
            </Field>

            <div className="flex items-center gap-5 pt-1">
              <Toggle checked={featured} onChange={setFeatured} label="Featured" hint="Pins to the top of the feed" icon={<Star className="w-3.5 h-3.5" />} />
              <Toggle checked={isPublished} onChange={setIsPublished} label="Published" hint="Visible in the mobile app" icon={<Eye className="w-3.5 h-3.5" />} />
            </div>

            {error && <p className="text-xs text-rose">{error}</p>}
          </div>

          {/* Live mobile preview */}
          <div className="border-t lg:border-t-0 lg:border-l border-border bg-muted/20 p-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Mobile preview</div>
            <div className="rounded-[20px] bg-card border border-border overflow-hidden shadow-sm max-w-[280px] mx-auto">
              <div className="w-full h-[150px] bg-muted flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                )}
              </div>
              <div className="p-4 space-y-2.5">
                <div className="text-[11px] text-muted-foreground">{previewTime}</div>
                <div className="text-[15px] font-bold leading-snug line-clamp-3">{title || "Your headline appears here"}</div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-muted-foreground truncate">{source || "Source"}</div>
                  <div className="text-[12px] font-semibold text-pine flex items-center gap-0.5">Read more ›</div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-3 leading-relaxed">
              This is how the article card renders in the app. Tapping it opens the full body.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border shrink-0">
          <button onClick={onClose} className="h-9 px-4 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
          <button onClick={save} disabled={!canSave || pending}
            className="h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-40 flex items-center gap-1.5">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEdit ? "Save changes" : "Publish article"}
          </button>
        </div>
      </div>

      <style>{`.form-input{width:100%;height:38px;padding:0 12px;border:1px solid var(--border,#e5e7eb);border-radius:3px;background:transparent;font-size:14px}.form-input:focus{outline:none;border-color:rgba(22,73,81,.5)}textarea.form-input{height:auto;padding:10px 12px}`}</style>
    </div>
  );
}

/* ── small pieces ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, icon }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; icon: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-left">
      <div className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${checked ? "bg-pine" : "bg-muted"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </div>
      <div>
        <div className="text-xs font-medium flex items-center gap-1.5">{icon} {label}</div>
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      </div>
    </button>
  );
}

function IconBtn({ children, title, onClick, tone }: {
  children: React.ReactNode; title: string; onClick: () => void; tone?: "rose";
}) {
  return (
    <button title={title} onClick={onClick}
      className={`w-7 h-7 rounded-[3px] flex items-center justify-center transition-colors ${
        tone === "rose" ? "text-muted-foreground hover:bg-rose/10 hover:text-rose" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}>
      {children}
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-[4px] bg-card border border-border p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}
