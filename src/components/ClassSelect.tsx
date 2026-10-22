import { useState } from "react";
import {
  ClassId, BossId, CLASSES, BOSSES, CLASS_ORDER, BOSS_ORDER,
} from "@/game/classes";
import type { Category } from "@/game/classes";
import { ArenaId } from "@/game/engine";
import {
  getProgress, getBossInfo, getClassRatings, getUnlockSources,
  formatChance, RARITY_COLOR, DIFFICULTY_COLOR, RATING_COLOR,
} from "@/game/rewards";
import { CosmeticsPanel } from "./CosmeticsPanel";
import { FighterPortrait } from './FighterPortrait';
import { useProgress } from '@/hooks/use-progress';
import { Link } from 'react-router-dom';

interface Props {
  selected: ClassId;
  onSelect: (id: ClassId) => void;
  arena: ArenaId;
  onArenaChange: (a: ArenaId) => void;
  onStart: (enemy: ClassId | BossId, arena: ArenaId, bossMode: boolean, useAltWeapon: boolean) => void;
  useAltWeapon: boolean;
  onAltWeaponChange: (v: boolean) => void;
}

const ARENAS: { id: ArenaId; name: string; desc: string }[] = [
  { id: "dojo", name: "DOJO", desc: "Calm wood floor" },
  { id: "rooftop", name: "ROOFTOP", desc: "Neon city skyline" },
  { id: "volcano", name: "VOLCANO", desc: "Molten danger zone" },
];

export const ClassSelect = ({ selected, onSelect, arena, onArenaChange, onStart, useAltWeapon, onAltWeaponChange }: Props) => {
  const [tab, setTab] = useState<"classes" | "boss">("classes");
  const [focusedLocked, setFocusedLocked] = useState<ClassId | null>(null);
  const [expandedBoss, setExpandedBoss] = useState<BossId | null>(null);
  const progress = useProgress();
  const isUnlocked = (id: ClassId) => progress.unlockedClasses.includes(id);

  const startVsClass = () => {
    const others = CLASS_ORDER.filter(c => c !== selected);
    const enemy = others[Math.floor(Math.random() * others.length)];
    onStart(enemy, arena, false, useAltWeapon);
  };
  const startVsBoss = (b: BossId) => onStart(b, arena, true, useAltWeapon);

  const c = CLASSES[selected];
  const hasAlt = !!c.altWeapon;

  const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
    brawler: { label: "BRAWLER", emoji: "⚔️" },
    speed:   { label: "SPEED",   emoji: "⚡" },
    heavy:   { label: "HEAVY",   emoji: "🪓" },
    ranged:  { label: "RANGED",  emoji: "🏹" },
    mage:    { label: "MAGE",    emoji: "🔮" },
  };
  const grouped: Record<Category, ClassId[]> = {
    brawler: [], speed: [], heavy: [], ranged: [], mage: [],
  };
  for (const id of CLASS_ORDER) grouped[CLASSES[id].category].push(id);
  const categoryOrder: Category[] = ["brawler", "speed", "heavy", "ranged", "mage"];
  const weaponLabel = (id?: string) => {
    switch (id) {
      case "katana": return "Katana";
      case "kunai": return "Kunai";
      case "fists": return "Fists";
      case "bow": return "Bow";
      case "axe": return "Axe";
      case "staff": return "Staff";
      case "gladius": return "Gladius";
      case "boxingGloves": return "Gloves";
      case "twinDaggers": return "Twin Daggers";
      case "lightningGauntlets": return "Gauntlets";
      case "execAxe": return "Heavy Axe";
      case "rifle": return "Rifle";
      case "stormStaff": return "Storm Staff";
      case "fireFists": return "Fire Fists";
      case "elementOrb": return "Element Orb";
      default: return id ?? "—";
    }
  };

  return (
    <div className="w-full bg-card/50 border border-border rounded-2xl p-5 md:p-7 space-y-5">
      {/* Tabs */}
      <div className="roster-wallet"><span>COINS <strong>{progress.currency.toLocaleString()}</strong> · {progress.xp.toLocaleString()} XP</span><Link to="/shop">CLASS SHOP →</Link></div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("classes")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              tab === "classes"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            VERSUS
          </button>
          <button
            onClick={() => setTab("boss")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              tab === "boss"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            👑 BOSS MODE
          </button>
        </div>
        {tab === "classes" && (
          <button
            onClick={startVsClass}
            className="px-5 py-2.5 rounded-lg bg-foreground text-background font-bold text-sm hover:opacity-90 transition"
          >
            FIGHT →
          </button>
        )}
      </div>

      {/* Choose your fighter */}
      <div>
        <h2 className="text-lg md:text-xl font-black tracking-tight mb-3">CHOOSE YOUR FIGHTER</h2>
        <div className="space-y-3">
          {categoryOrder.map((cat) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <span>{CATEGORY_META[cat].emoji}</span>
                <span className="font-bold">{CATEGORY_META[cat].label}</span>
                <span className="opacity-60">· {grouped[cat].length}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {grouped[cat].map((id) => {
                  const k = CLASSES[id];
                  const isSel = id === selected;
                  const unlocked = isUnlocked(id);
                  return (
                    <button
                      key={id}
                      onClick={() => unlocked ? onSelect(id) : setFocusedLocked(id)}
                      aria-pressed={isSel}
                      className={`relative text-left p-3 pr-14 rounded-lg border-2 transition ${
                        isSel
                          ? "border-foreground bg-foreground/5"
                          : !unlocked
                          ? "border-border/40 bg-card/40 opacity-70 hover:opacity-100 hover:border-foreground/40"
                          : "border-border hover:border-foreground/50 bg-card"
                      }`}
                    >
                      <FighterPortrait fighter={k}/>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-black tracking-tight text-sm truncate" style={{ color: k.color }}>
                          {unlocked ? k.name : `🔒 ${k.name}`}
                        </h3>
                        <span
                          className={`w-2 h-2 rounded-full ${isSel ? "" : "opacity-30"}`}
                          style={{ background: k.color }}
                        />
                      </div>
                      {unlocked ? (
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{k.blurb}</p>
                      ) : (
                        <UnlockHint id={id} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Locked class detail */}
      {focusedLocked && !isUnlocked(focusedLocked) && (
        <LockedClassPanel
          id={focusedLocked}
          onClose={() => setFocusedLocked(null)}
          onViewBoss={(bid) => {
            setTab("boss");
            setExpandedBoss(bid);
            setFocusedLocked(null);
          }}
        />
      )}

      {/* Cosmetics */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Cosmetics · 🎁 Boss drops</div>
        <CosmeticsPanel playerClass={selected} />
      </div>

      {/* Selected class abilities */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Abilities</div>
            <div className="font-black text-base" style={{ color: c.color }}>{c.name}</div>
          </div>
          <div className="flex gap-2 text-[10px]">
            <Stat label="HP" value={c.hp} />
            <Stat label="SPD" value={c.speedMul.toFixed(2) + "×"} />
            <Stat label="DMG" value={c.damageMul.toFixed(2) + "×"} />
          </div>
        </div>
        {/* Ratings strip */}
        <RatingsStrip classId={selected} />
        {/* Weapon row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Weapon</div>
          {hasAlt ? (
            <div className="inline-flex rounded-lg border border-border bg-secondary/40 overflow-hidden">
              <button
                onClick={() => onAltWeaponChange(false)}
                className={`px-3 py-1.5 text-xs font-bold transition ${
                  !useAltWeapon ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {weaponLabel(c.weapon)}
              </button>
              <button
                onClick={() => onAltWeaponChange(true)}
                className={`px-3 py-1.5 text-xs font-bold transition ${
                  useAltWeapon ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {weaponLabel(c.altWeapon)}
              </button>
            </div>
          ) : (
            <div className="text-xs font-bold px-2 py-1 rounded bg-secondary/60 border border-border">
              {weaponLabel(c.weapon)}
            </div>
          )}
          {c.id === "viking" && (
            <div className="text-[10px] text-muted-foreground">
              Throw axe with <kbd className="px-1 rounded bg-secondary border border-border font-mono">1</kbd>, press <kbd className="px-1 rounded bg-secondary border border-border font-mono">1</kbd> again to recall.
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {c.abilities.map((a, i) => (
            <div key={a.id} className="rounded-lg border border-border bg-secondary/40 p-3 flex items-start gap-2">
              <div className="w-7 h-7 rounded bg-background border border-border grid place-items-center font-mono text-xs font-bold">
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold flex items-center gap-1.5 truncate">
                  <span>{a.icon}</span>
                  <span className="truncate">{a.name}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{a.cooldown}s cooldown</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-[10px] font-bold">K</kbd>
          {" "}hold for <span className="font-bold text-foreground">M2 Heavy</span> — release to fire. Full charge stuns brawlers/heavies.
        </div>
      </div>

      {/* Arena */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Arena</div>
        <div className="grid grid-cols-3 gap-2">
          {ARENAS.map((a) => (
            <button
              key={a.id}
              onClick={() => onArenaChange(a.id)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                arena === a.id
                  ? "border-foreground bg-foreground/5"
                  : "border-border hover:border-foreground/50 bg-card"
              }`}
            >
              <div className="text-sm font-bold">{a.name}</div>
              <div className="text-[10px] text-muted-foreground">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Boss list */}
      {tab === "boss" && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Pick a boss to fight as <span className="text-foreground font-bold">{c.name}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {BOSS_ORDER.map((bid) => (
              <BossCard
                key={bid}
                bossId={bid}
                expanded={expandedBoss === bid}
                onToggle={() => setExpandedBoss(expandedBoss === bid ? null : bid)}
                onChallenge={() => startVsBoss(bid)}
                ownedClasses={progress.unlockedClasses}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="px-2 py-1 rounded bg-secondary/60 border border-border">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-mono text-xs font-bold">{value}</div>
  </div>
);

// ----- Locked-class hint shown inside the grid card -----
const UnlockHint = ({ id }: { id: ClassId }) => {
  const sources = getUnlockSources(id);
  if (sources.length === 0) {
    return <p className="text-[10px] text-muted-foreground line-clamp-2">Locked.</p>;
  }
  const top = sources[0];
  return (
    <div className="text-[10px] text-muted-foreground leading-tight">
      <div className="truncate">Defeat <span className="text-foreground font-bold">{BOSSES[top.bossId].name}</span></div>
      <div className="font-mono opacity-80">Drop: {formatChance(top.chance)}{sources.length > 1 ? ` · +${sources.length - 1} more` : ""}</div>
    </div>
  );
};

// ----- Locked class detail panel (under the grid) -----
const LockedClassPanel = ({
  id, onClose, onViewBoss,
}: { id: ClassId; onClose: () => void; onViewBoss: (b: BossId) => void }) => {
  const k = CLASSES[id];
  const sources = getUnlockSources(id);
  const ratings = getClassRatings(id);
  return (
    <div className="rounded-xl border-2 border-border bg-card p-4 relative">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded bg-secondary/60 hover:bg-secondary border border-border text-muted-foreground"
        aria-label="Close locked class details"
      >
        ✕
      </button>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs">🔒</span>
        <div className="font-black text-base" style={{ color: k.color }}>{k.name}</div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">Locked</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{k.blurb}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <RatingPill label="Strength" value={ratings.strength} />
        <RatingPill label="Speed" value={ratings.speed} />
        <RatingPill label="Mastery" value={ratings.difficulty} />
      </div>

      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Unlock requirements</div>
      {sources.length === 0 ? (
        <div className="text-xs text-muted-foreground">No known unlock source yet.</div>
      ) : (
        <div className="space-y-1.5">
          {sources.map((s) => {
            const b = BOSSES[s.bossId];
            return (
              <div key={s.bossId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/30">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: b.color }}>{b.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Drop chance: {formatChance(s.chance)}</div>
                </div>
                <button
                  onClick={() => onViewBoss(s.bossId)}
                  className="text-[10px] font-bold px-3 py-1.5 rounded bg-foreground text-background hover:opacity-90"
                >
                  VIEW BOSS →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ----- Ratings strip on selected-class panel -----
const RatingsStrip = ({ classId }: { classId: ClassId }) => {
  const r = getClassRatings(classId);
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      <RatingPill label="Strength" value={r.strength} />
      <RatingPill label="Speed" value={r.speed} />
      <RatingPill label="Mastery" value={r.difficulty} />
    </div>
  );
};

const RatingPill = ({ label, value }: { label: string; value: keyof typeof RATING_COLOR }) => (
  <div className="px-2 py-1 rounded bg-secondary/60 border border-border flex items-center gap-1.5">
    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className="text-[10px] font-bold" style={{ color: RATING_COLOR[value] }}>{value}</span>
  </div>
);

// ----- Detailed boss card (drop table + difficulty + recommended) -----
interface BossCardProps {
  bossId: BossId;
  expanded: boolean;
  onToggle: () => void;
  onChallenge: () => void;
  ownedClasses: ClassId[];
}
const BossCard = ({ bossId, expanded, onToggle, onChallenge, ownedClasses }: BossCardProps) => {
  const b = BOSSES[bossId];
  const info = getBossInfo(bossId);
  return (
    <div className="rounded-xl border-2 border-border hover:border-foreground/60 bg-card transition overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">BOSS</div>
            <div className="font-black text-lg truncate" style={{ color: b.color }}>{b.name}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">HP</div>
            <div className="text-xs font-mono">{b.hp}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{b.blurb}</p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span
            className="text-[10px] px-2 py-0.5 rounded font-bold border"
            style={{ borderColor: DIFFICULTY_COLOR[info.difficulty], color: DIFFICULTY_COLOR[info.difficulty] }}
          >
            {info.difficulty}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
            Recommended: <span className="text-foreground font-bold">{info.recommended}</span>
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded font-bold border uppercase tracking-wider"
            style={{ borderColor: RARITY_COLOR[info.rewardTier], color: RARITY_COLOR[info.rewardTier] }}
          >
            {info.rewardTier} tier
          </span>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Drops</div>
        <div className="space-y-1 mb-3">
          {(expanded ? info.drops : info.drops.slice(0, 3)).map((d, idx) => {
            const owned = d.kind === "class" && d.id && ownedClasses.includes(d.id as ClassId);
            return (
              <div
                key={d.kind + (d.id ?? "") + idx}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-border bg-secondary/30 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RARITY_COLOR[d.rarity] }} />
                  <span className="truncate" style={d.color ? { color: d.color } : undefined}>
                    {d.kind === "class" ? "🧬 " : d.kind === "cosmetic" ? "🎨 " : "💰 "}
                    {d.label}
                  </span>
                  {owned && <span className="text-[9px] uppercase tracking-wider text-muted-foreground">· owned</span>}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  {formatChance(d.chance)}
                </span>
              </div>
            );
          })}
          {!expanded && info.drops.length > 3 && (
            <button
              onClick={onToggle}
              className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground px-2"
            >
              + {info.drops.length - 3} more drops
            </button>
          )}
          {expanded && (
            <button
              onClick={onToggle}
              className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground px-2"
            >
              Show less
            </button>
          )}
        </div>

        <button
          onClick={onChallenge}
          className="w-full px-3 py-2 rounded-lg bg-foreground text-background font-bold text-xs hover:opacity-90 transition"
        >
          CHALLENGE →
        </button>
      </div>
    </div>
  );
};
