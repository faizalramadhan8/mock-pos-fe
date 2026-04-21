import { useEffect, useMemo, useRef, useState } from "react";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  id: string;
  label: string;
  subtitle?: string;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  maxVisible?: number;
}

/**
 * A dropdown with inline search. Keeps only `maxVisible` (default 100) items
 * rendered at a time so it stays fast on catalogs of thousands.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih…",
  disabled,
  emptyMessage = "Tidak ada hasil",
  maxVisible = 100,
}: Props) {
  const th = useThemeClasses();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.id === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.subtitle ?? "").toLowerCase().includes(q)
    );
  }, [options, query]);

  const visible = filtered.slice(0, maxVisible);
  const hasMore = filtered.length > maxVisible;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Autofocus search when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm rounded-2xl border ${th.inp} ${disabled ? "opacity-50" : ""}`}
      >
        <span className={`truncate ${selected ? th.tx : th.txf}`}>
          {selected ? selected.label : placeholder}
          {selected?.subtitle && (
            <span className={`ml-2 text-xs font-normal ${th.txf}`}>· {selected.subtitle}</span>
          )}
        </span>
        <ChevronDown size={14} className={`shrink-0 ml-2 ${th.txf} transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`absolute top-full left-0 right-0 mt-1 z-30 rounded-xl border shadow-lg overflow-hidden ${th.card} ${th.bdr}`}>
          <div className={`flex items-center gap-2 p-2 border-b ${th.bdr}`}>
            <Search size={14} className={th.txf} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari…"
              className={`flex-1 bg-transparent outline-none text-sm ${th.tx} placeholder:${th.txf}`}
            />
            {query && (
              <button onClick={() => setQuery("")} type="button" className={th.txf}>
                <X size={14} />
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <p className={`text-xs text-center py-6 ${th.txm}`}>{emptyMessage}</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {visible.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
                  className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:opacity-70 ${th.bdrSoft} ${o.id === value ? th.accBg : ""}`}
                >
                  <p className={`font-semibold ${th.tx} truncate`}>{o.label}</p>
                  {o.subtitle && <p className={`text-xs ${th.txm}`}>{o.subtitle}</p>}
                </button>
              ))}
              {hasMore && (
                <p className={`text-xs text-center py-2 ${th.txm}`}>
                  {filtered.length - maxVisible} hasil lagi — ketik untuk mempersempit
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
