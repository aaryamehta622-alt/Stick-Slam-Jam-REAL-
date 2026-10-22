import { useState } from "react";
import { Cosmetic, COSMETICS, CosmeticKind, equipCosmetic, getProgress, RARITY_COLOR } from "@/game/rewards";
import { ClassId } from "@/game/classes";
import { useProgress } from '@/hooks/use-progress';

export const CosmeticsPanel = ({ playerClass, onChange }: { playerClass: ClassId; onChange?: () => void }) => {
  const [, setTick] = useState(0);
  const [message,setMessage]=useState('');
  const p = useProgress();
  const owned = COSMETICS.filter(c => p.cosmetics.includes(c.id));
  const groups: Record<CosmeticKind, Cosmetic[]> = { aura: [], trail: [], hitFx: [], skin: [] };
  for (const c of owned) {
    // Skins are class-specific — only show ones for the active class
    if (c.kind === "skin" && c.forClass && c.forClass !== playerClass) continue;
    groups[c.kind].push(c);
  }
  const labels: Record<CosmeticKind, string> = { aura: "Auras", trail: "Trails", hitFx: "Hit Effects", skin: "Skins" };

  const equip = async (kind: CosmeticKind, id: string | null) => {
    try{await equipCosmetic(kind, id, kind === "skin" ? playerClass : undefined);setMessage('');setTick(t=>t+1);onChange?.();}
    catch(error){setMessage(error instanceof Error?error.message:'Unable to equip this cosmetic.');}
  };

  const totalShown = groups.aura.length + groups.trail.length + groups.hitFx.length + groups.skin.length;
  if (totalShown === 0) {
    return (
      <div className="text-xs text-muted-foreground p-3 rounded-lg bg-secondary/40 border border-border">
        No cosmetics for {playerClass} yet — defeat bosses to earn auras, trails, hit effects & skins.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message&&<p role="alert" className="text-xs text-orange-200">{message}</p>}
      {(["aura", "trail", "hitFx", "skin"] as CosmeticKind[]).map((kind) => (
        groups[kind].length > 0 && (
          <div key={kind}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-bold">
              {labels[kind]}{kind === "skin" ? ` · ${playerClass}` : ""}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => equip(kind, null)}
                className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                  (kind === "skin"
                    ? !p.equipped.skin?.[playerClass]
                    : !(p.equipped as any)[kind])
                    ? "border-foreground bg-foreground/10"
                    : "border-border bg-card hover:border-foreground/40"
                }`}
              >
                NONE
              </button>
              {groups[kind].map((c) => {
                const equipped = kind === "skin"
                  ? p.equipped.skin?.[playerClass] === c.id
                  : (p.equipped as any)[kind] === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => equip(kind, c.id)}
                    className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                      equipped ? "border-foreground bg-foreground/10" : "border-border bg-card hover:border-foreground/40"
                    }`}
                    style={{ color: c.color, borderColor: equipped ? c.color : undefined }}
                  >
                    {c.name}
                    <span className="ml-1 opacity-60" style={{ color: RARITY_COLOR[c.rarity] }}>·{c.rarity[0].toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )
      ))}
      <div className="flex gap-3 text-[11px] text-muted-foreground pt-1">
        <span>💰 {p.currency}</span>
        <span>⭐ {p.xp} XP</span>
      </div>
    </div>
  );
};
