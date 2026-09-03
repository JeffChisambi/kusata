import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X, Check, AlertTriangle, ListChecks,
} from "lucide-react";
import { SecuritiesIcon } from "@/components/pine-icons";
import { Card } from "@/components/broker-shell";
import { requireSuperAdmin } from "@/lib/auth";
import {
  useTreasuryProducts, useTreasuryInvestments, useCreateTreasuryProduct,
  useUpdateTreasuryProduct, useDeleteTreasuryProduct,
  type TreasuryProduct, type TreasuryProductInput,
} from "@/hooks/useTreasuryAdmin";

export const Route = createFileRoute("/treasury")({
  head: () => ({ meta: [{ title: "Treasury — Pine Broker Admin" }] }),
  beforeLoad: () => requireSuperAdmin(),
  component: TreasuryAdminPage,
});

const fmtMWK = (n: number) => `MWK ${n.toLocaleString("en-MW")}`;
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const toISODate = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function TreasuryAdminPage() {
  const [tab, setTab] = useState<"products" | "orders">("products");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[3px] bg-pine/10 text-pine flex items-center justify-center">
          <SecuritiesIcon className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Treasury Bills</h1>
          <p className="text-xs text-muted-foreground">Manage T-bill offerings shown in the mobile app and review investment orders.</p>
        </div>
      </div>

      <div className="flex border-b border-border">
        {(["products", "orders"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative py-2.5 px-4 text-sm font-medium ${tab === t ? "text-pine" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "products" ? "Offerings" : "Investment orders"}
            {tab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
          </button>
        ))}
      </div>

      {tab === "products" ? <ProductsTab /> : <OrdersTab />}
    </div>
  );
}

/* ── Offerings ── */
function ProductsTab() {
  const { data, isLoading, isError } = useTreasuryProducts();
  const del = useDeleteTreasuryProduct();
  const update = useUpdateTreasuryProduct();
  const [editing, setEditing] = useState<TreasuryProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TreasuryProduct | null>(null);

  const products = data?.products ?? [];
  const toggleActive = (p: TreasuryProduct) => update.mutate({ id: p.id, input: { isActive: !p.isActive } });

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setCreating(true)}
          className="h-9 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New T-bill
        </button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="py-14 text-center text-sm text-rose flex flex-col items-center gap-2"><AlertTriangle className="w-6 h-6" /> Failed to load.</div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <SecuritiesIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No treasury bills yet.</p>
            <button onClick={() => setCreating(true)} className="mt-3 text-sm text-pine font-medium">Add the first one</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <th className="pl-5 py-2.5 text-left font-medium">Tenor</th>
                  <th className="py-2.5 text-left font-medium">Yield</th>
                  <th className="py-2.5 text-left font-medium">Min invest</th>
                  <th className="py-2.5 text-left font-medium">Maturity</th>
                  <th className="py-2.5 text-left font-medium">Status</th>
                  <th className="pr-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-muted/20">
                    <td className="pl-5 py-3 font-medium">{p.tenorDays}-Day
                      <span className="text-[11px] text-muted-foreground ml-1.5">{p.riskLevel} risk</span>
                    </td>
                    <td className="py-3 text-pine font-semibold">{p.yieldPercent}%</td>
                    <td className="py-3 text-muted-foreground">{fmtMWK(p.minAmount)}</td>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">{p.maturityDate || "—"}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        p.isActive ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"}`}>
                        {p.isActive ? p.status : "inactive"}
                      </span>
                    </td>
                    <td className="pr-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title={p.isActive ? "Deactivate" : "Activate"} onClick={() => toggleActive(p)}>
                          {p.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </IconBtn>
                        <IconBtn title="Edit" onClick={() => setEditing(p)}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn title="Delete" tone="rose" onClick={() => setConfirmDelete(p)}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(creating || editing) && <ProductEditor product={editing} onClose={() => { setCreating(false); setEditing(null); }} />}

      {confirmDelete && (
        <Modal title="Delete T-bill" onClose={() => setConfirmDelete(null)}>
          <p className="text-xs text-muted-foreground mb-4">Delete the <strong>{confirmDelete.tenorDays}-day</strong> T-bill? If it has investments it will be archived (hidden) instead.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40">Cancel</button>
            <button onClick={() => del.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })} disabled={del.isPending}
              className="h-8 px-4 rounded-[3px] bg-rose text-white text-xs font-medium hover:bg-rose/90 flex items-center gap-1.5 disabled:opacity-50">
              {del.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ProductEditor({ product, onClose }: { product: TreasuryProduct | null; onClose: () => void }) {
  const create = useCreateTreasuryProduct();
  const update = useUpdateTreasuryProduct();
  const isEdit = !!product;

  const [f, setF] = useState({
    tenorDays: product?.tenorDays ?? 91,
    yieldPercent: product?.yieldPercent ?? 24.5,
    minAmount: product?.minAmount ?? 100000,
    maxAmount: product?.maxInvestment ?? undefined as number | undefined,
    riskLevel: product?.riskLevel ?? "Very Low",
    auctionDate: toISODate(product?.auctionDate),
    issueDate: toISODate(product?.issueDate),
    maturityDate: toISODate(product?.maturityDate),
    status: product?.status ?? "open",
    isActive: product?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const pending = create.isPending || update.isPending;
  const save = () => {
    setError(null);
    const input: TreasuryProductInput = {
      label: `${f.tenorDays}-Day Treasury Bill`,
      tenorDays: Number(f.tenorDays),
      yieldPercent: Number(f.yieldPercent),
      minAmount: Number(f.minAmount),
      maxAmount: f.maxAmount != null && f.maxAmount !== ("" as any) ? Number(f.maxAmount) : null,
      riskLevel: f.riskLevel,
      auctionDate: f.auctionDate || undefined,
      issueDate: f.issueDate || undefined,
      maturityDate: f.maturityDate || undefined,
      status: f.status,
      isActive: f.isActive,
    };
    const done = { onSuccess: () => onClose(), onError: (e: any) => setError(e?.message ?? "Save failed.") };
    if (isEdit && product) update.mutate({ id: product.id, input }, done);
    else create.mutate(input, done);
  };

  return (
    <Modal title={isEdit ? "Edit T-bill" : "New T-bill"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Tenor (days)">
          <select className="ti" value={f.tenorDays} onChange={(e) => setF({ ...f, tenorDays: Number(e.target.value) })}>
            {[91, 182, 364].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </Field>
        <Field label="Annual yield (%)"><input className="ti" type="number" step="0.1" value={f.yieldPercent} onChange={(e) => setF({ ...f, yieldPercent: Number(e.target.value) })} /></Field>
        <Field label="Minimum investment (MWK)"><input className="ti" type="number" value={f.minAmount} onChange={(e) => setF({ ...f, minAmount: Number(e.target.value) })} /></Field>
        <Field label="Maximum (optional)"><input className="ti" type="number" value={f.maxAmount ?? ""} onChange={(e) => setF({ ...f, maxAmount: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
        <Field label="Risk level">
          <select className="ti" value={f.riskLevel} onChange={(e) => setF({ ...f, riskLevel: e.target.value })}>
            <option>Very Low</option><option>Low</option>
          </select>
        </Field>
        <Field label="Status">
          <select className="ti" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="open">Open</option><option value="closing_soon">Closing soon</option><option value="closed">Closed</option>
          </select>
        </Field>
        <Field label="Auction date"><input className="ti" type="date" value={f.auctionDate} onChange={(e) => setF({ ...f, auctionDate: e.target.value })} /></Field>
        <Field label="Issue date"><input className="ti" type="date" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} /></Field>
        <Field label="Maturity date"><input className="ti" type="date" value={f.maturityDate} onChange={(e) => setF({ ...f, maturityDate: e.target.value })} /></Field>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active (visible in app)
          </label>
        </div>
      </div>
      {error && <p className="text-xs text-rose mt-3">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="h-9 px-4 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
        <button onClick={save} disabled={pending} className="h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-40 flex items-center gap-1.5">
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {isEdit ? "Save" : "Create"}
        </button>
      </div>
      <style>{`.ti{width:100%;height:36px;padding:0 10px;border:1px solid var(--border,#e5e7eb);border-radius:3px;background:transparent;font-size:14px}.ti:focus{outline:none;border-color:rgba(22,73,81,.5)}`}</style>
    </Modal>
  );
}

/* ── Investment orders ── */
function OrdersTab() {
  const { data, isLoading, isError } = useTreasuryInvestments();
  const investments = data?.investments ?? [];
  return (
    <Card className="!p-0 overflow-hidden">
      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="py-14 text-center text-sm text-rose">Failed to load.</div>
      ) : investments.length === 0 ? (
        <div className="py-16 text-center">
          <ListChecks className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No treasury investment orders yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                <th className="pl-5 py-2.5 text-left font-medium">Investor</th>
                <th className="py-2.5 text-left font-medium">Tenor</th>
                <th className="py-2.5 text-left font-medium">Amount</th>
                <th className="py-2.5 text-left font-medium">Maturity value</th>
                <th className="py-2.5 text-left font-medium">Maturity</th>
                <th className="py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {investments.map((iv) => (
                <tr key={iv.investmentId} className="border-b border-border hover:bg-muted/20">
                  <td className="pl-5 py-3">
                    <div className="font-medium text-[13px]">{iv.user?.name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{iv.user?.phone ?? ""}</div>
                  </td>
                  <td className="py-3 text-muted-foreground">{iv.product?.duration ?? iv.product?.tenorDays ?? "—"}-Day</td>
                  <td className="py-3 font-medium">{fmtMWK(Number(iv.amount))}</td>
                  <td className="py-3 text-pine">{fmtMWK(Number(iv.maturityValue))}</td>
                  <td className="py-3 text-muted-foreground whitespace-nowrap">{fmtDate(iv.maturityDate)}</td>
                  <td className="py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{iv.status.toLowerCase()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ── small pieces ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>{children}</div>;
}
function IconBtn({ children, title, onClick, tone }: { children: React.ReactNode; title: string; onClick: () => void; tone?: "rose" }) {
  return <button title={title} onClick={onClick} className={`w-7 h-7 rounded-[3px] flex items-center justify-center transition-colors ${tone === "rose" ? "text-muted-foreground hover:bg-rose/10 hover:text-rose" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>{children}</button>;
}
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-[4px] bg-card border border-border p-5 shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-[3px] hover:bg-muted/60 flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
