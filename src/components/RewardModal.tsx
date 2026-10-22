import { useEffect, useState } from "react";
import { DropResult, RARITY_COLOR, getBossInfo, formatChance } from "@/game/rewards";
import { CLASSES, BOSSES, BossId } from "@/game/classes";

interface Props {
  result: DropResult;
  bossId?: BossId;
  onClose: () => void;
}

export const RewardModal = ({ result, bossId, onClose }: Props) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 60);
    return () => clearTimeout(t);
  }, []);

  const color = RARITY_COLOR[result.rarity];
  const title =
    result.classUnlocked
      ? "NEW FIGHTER UNLOCKED"
      : result.cosmetic
      ? "COSMETIC ACQUIRED"
      : "COMMON REWARD ACQUIRED";

  const bossInfo = bossId ? getBossInfo(bossId) : null;
  const earnedKey = result.classUnlocked
    ? `class:${result.classUnlocked}`
    : result.cosmetic
    ? `cosmetic:${result.cosmetic.id}`
    : "currency";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`relative max-w-md w-[92%] rounded-2xl border-2 p-6 md:p-8 text-center transition-all duration-500 ${show ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        style={{
          borderColor: color,
          background: `linear-gradient(160deg, hsl(220 20% 8%), hsl(220 20% 12%))`,
          boxShadow: `0 0 80px ${color}55, 0 0 30px ${color}88`,
        }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.3em] font-bold mb-2"
          style={{ color }}
        >
          {result.rarity}
        </div>
        <div className="text-2xl md:text-3xl font-black tracking-tight mb-4" style={{ color }}>
          {title}
        </div>

        {result.classUnlocked && (
          <div className="mb-4">
            <div className="text-5xl md:text-6xl font-black tracking-tight" style={{ color: CLASSES[result.classUnlocked].color }}>
              {CLASSES[result.classUnlocked].name}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {CLASSES[result.classUnlocked].blurb}
            </p>
          </div>
        )}

        {result.cosmetic && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {result.cosmetic.kind}
            </div>
            <div className="text-2xl font-black mt-1" style={{ color: result.cosmetic.color }}>
              {result.cosmetic.name}
            </div>
          </div>
        )}

        {result.alreadyOwned && (
          <div className="text-xs text-muted-foreground mb-3">
            (class already owned — bonus coins instead)
          </div>
        )}

        <div className="flex items-center justify-center gap-4 text-sm font-bold mb-6">
          <span className="px-3 py-1.5 rounded-lg bg-secondary border border-border">
            💰 +{result.currency}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-secondary border border-border">
            ⭐ +{result.xp} XP
          </span>
        </div>

        {bossInfo && (
          <div className="text-left mb-5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Drop table · {BOSSES[bossInfo.id].name}
            </div>
            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {bossInfo.drops.map((d) => {
                const key =
                  d.kind === "class" ? `class:${d.id}` :
                  d.kind === "cosmetic" ? `cosmetic:${d.id}` :
                  "currency";
                const earned = key === earnedKey;
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-xs transition ${
                      earned ? "border-2" : "border-border bg-secondary/30 opacity-70"
                    }`}
                    style={earned ? {
                      borderColor: RARITY_COLOR[d.rarity],
                      background: `${RARITY_COLOR[d.rarity]}1a`,
                    } : undefined}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: RARITY_COLOR[d.rarity] }}
                      />
                      <span className={`truncate ${earned ? "font-bold" : ""}`} style={earned ? { color: RARITY_COLOR[d.rarity] } : undefined}>
                        {d.label}
                      </span>
                      {earned && <span className="text-[9px] uppercase tracking-wider font-bold ml-1" style={{ color: RARITY_COLOR[d.rarity] }}>· EARNED</span>}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {formatChance(d.chance)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-5 py-3 rounded-lg font-bold text-sm transition hover:opacity-90"
          style={{ background: color, color: "#0a0a0e" }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
};
