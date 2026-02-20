import { useState } from "react";
import { useLangStore, useThemeStore, useSettingsStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { Sun, Moon } from "lucide-react";
import toast from "react-hot-toast";

export function SettingsPage() {
  const th = useThemeClasses();
  const { t, lang, setLang } = useLangStore();
  const { dark, toggle } = useThemeStore();
  const settings = useSettingsStore();

  const [storeName, setStoreName] = useState(settings.storeName);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [storePhone, setStorePhone] = useState(settings.storePhone);

  const handleSave = () => {
    settings.update({ storeName, storeAddress, storePhone });
    toast.success(t.settingsSaved as string);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>{t.settings}</h1>

      <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
        <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>{t.theme}</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ k: false, l: t.light, ic: <Sun size={14} /> }, { k: true, l: t.dark, ic: <Moon size={14} /> }].map(o => (
            <button key={String(o.k)} onClick={() => dark !== o.k && toggle()}
              className={`py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${
                dark === o.k ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.bdr} ${th.txm}`
              }`}>{o.ic} {o.l}</button>
          ))}
        </div>
      </div>

      <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
        <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>{t.language}</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ k: "en" as const, l: "English", f: "🇬🇧" }, { k: "id" as const, l: "Indonesia", f: "🇮🇩" }].map(o => (
            <button key={o.k} onClick={() => setLang(o.k)}
              className={`py-3.5 rounded-2xl text-sm font-bold ${
                lang === o.k ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.bdr} ${th.txm}`
              }`}>{o.f} {o.l}</button>
          ))}
        </div>
      </div>

      <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
        <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>{t.storeInfo}</p>
        <div className="flex flex-col gap-2">
          <input value={storeName} onChange={e => setStoreName(e.target.value)}
            className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`} placeholder={t.storeName as string} />
          <input value={storeAddress} onChange={e => setStoreAddress(e.target.value)}
            className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`} placeholder={t.storeAddress as string} />
          <input value={storePhone} onChange={e => setStorePhone(e.target.value)}
            className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`} placeholder={t.storePhone as string} />
          <button onClick={handleSave}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C] mt-1">{t.save}</button>
        </div>
      </div>
    </div>
  );
}
