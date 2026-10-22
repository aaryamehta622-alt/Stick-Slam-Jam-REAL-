// Loot/reward + cosmetics persistence layer.
// Stored in localStorage. Pure functions — UI subscribes via getProgress().

import { ClassId, BossId } from "./classes";

export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9ad",
  rare: "#7bb6ff",
  epic: "#c79bff",
  legendary: "#ffd060",
};

export type CosmeticKind = "aura" | "trail" | "hitFx" | "skin";
export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  rarity: Rarity;
  color: string;
  forClass?: ClassId; // skins are class-specific
}

export const COSMETICS: Cosmetic[] = [
  { id: "aura-fire",      kind: "aura",  name: "Ember Aura",      rarity: "common", color: "#ff7050" },
  { id: "aura-ice",       kind: "aura",  name: "Frost Aura",      rarity: "common", color: "#aee0ff" },
  { id: "aura-storm",     kind: "aura",  name: "Storm Aura",      rarity: "rare",   color: "#7bb6ff" },
  { id: "aura-arcane",    kind: "aura",  name: "Arcane Aura",     rarity: "epic",   color: "#c79bff" },
  { id: "aura-solar",     kind: "aura",  name: "Solar Crown",     rarity: "legendary", color: "#ffd060" },
  { id: "trail-neon",     kind: "trail", name: "Neon Trail",      rarity: "common", color: "#7df0c0" },
  { id: "trail-shadow",   kind: "trail", name: "Shadow Trail",    rarity: "rare",   color: "#9f7dff" },
  { id: "trail-prism",    kind: "trail", name: "Prism Trail",     rarity: "epic",   color: "#ff9bd0" },
  { id: "hit-spark",      kind: "hitFx", name: "Spark Burst",     rarity: "common", color: "#ffe24a" },
  { id: "hit-frost",      kind: "hitFx", name: "Frost Burst",     rarity: "rare",   color: "#aee0ff" },
  { id: "hit-supernova",  kind: "hitFx", name: "Supernova",       rarity: "legendary", color: "#ffb14d" },
  { id: "skin-samurai-shogun", kind: "skin", name: "Shogun Skin", rarity: "epic", color: "#ffd060", forClass: "samurai" },
  { id: "skin-ninja-void",     kind: "skin", name: "Void Skin",   rarity: "rare", color: "#9f7dff", forClass: "ninja" },
  { id: "skin-mage-stellar",   kind: "skin", name: "Stellar Skin", rarity: "epic", color: "#7bb6ff", forClass: "mage" },
];

// Boss → reward weights
export interface BossReward {
  classUnlock?: ClassId;
  classChance: number; // 0..1
  cosmeticPool: string[]; // cosmetic IDs weighted equally
  currency: number;
  xp: number;
}
export const BOSS_REWARDS: Record<BossId, BossReward> = {
  giantBrute:     { classChance: 0,    currency: 50, xp: 100, cosmeticPool: ["aura-fire", "hit-spark", "trail-neon"] },
  shadowAssassin: { classUnlock: "ninja", classChance: 0.18, currency: 80, xp: 150, cosmeticPool: ["trail-shadow", "aura-arcane", "skin-ninja-void"] },
  warMachine:     { classUnlock: "sniper", classChance: 0.15, currency: 70, xp: 130, cosmeticPool: ["hit-spark", "aura-storm"] },
  elementalTitan: { classUnlock: "elementalist", classChance: 0.05, currency: 120, xp: 200, cosmeticPool: ["aura-fire", "aura-ice", "aura-storm", "trail-prism", "hit-frost"] },
  arenaChampion:  { classUnlock: "gladiator", classChance: 0.20, currency: 90, xp: 160, cosmeticPool: ["skin-samurai-shogun", "aura-solar", "hit-supernova"] },
  shadowRogue:    { classUnlock: "assassin", classChance: 0.18, currency: 85, xp: 150, cosmeticPool: ["trail-shadow", "aura-arcane"] },
  titanGuardian:  { classUnlock: "executioner", classChance: 0.12, currency: 110, xp: 180, cosmeticPool: ["aura-solar", "hit-supernova"] },
  arcaneEntity:   { classUnlock: "stormMage", classChance: 0.15, currency: 130, xp: 210, cosmeticPool: ["aura-arcane", "trail-prism", "skin-mage-stellar", "aura-storm"] },
};

export interface DropResult {
  saved?: boolean;
  alreadyClaimed?: boolean;
  classUnlocked?: ClassId;
  cosmetic?: Cosmetic;
  currency: number;
  xp: number;
  rarity: Rarity;
  alreadyOwned?: boolean;
}

// ============================================================
// PUBLIC DROP TABLES + RATINGS — exposed for transparent UI.
// ============================================================

export type Difficulty = "Easy" | "Medium" | "Hard" | "Extreme";
export type Rating = "Low" | "Medium" | "High" | "Very High";

export interface DropEntry {
  kind: "class" | "cosmetic" | "currency" | "xp";
  id?: string;            // class id or cosmetic id
  label: string;          // display name
  chance: number;         // 0..1   (1 == guaranteed)
  rarity: Rarity;
  color?: string;
}

export interface BossInfo {
  id: BossId;
  difficulty: Difficulty;
  recommended: string;    // recommended class type
  rewardTier: Rarity;     // overall reward quality
  drops: DropEntry[];
}

export interface ClassUnlockInfo {
  classId: ClassId;
  bosses: { bossId: BossId; chance: number }[]; // empty = starter
  strength: Rating;
  speed: Rating;
  difficulty: Rating;     // difficulty to master
}

const BOSS_DIFFICULTY: Record<BossId, Difficulty> = {
  giantBrute: "Easy",
  shadowAssassin: "Medium",
  warMachine: "Medium",
  elementalTitan: "Extreme",
  arenaChampion: "Hard",
  shadowRogue: "Hard",
  titanGuardian: "Hard",
  arcaneEntity: "Extreme",
};
const BOSS_RECOMMENDED: Record<BossId, string> = {
  giantBrute: "Speed / Ranged",
  shadowAssassin: "Mage / Ranged",
  warMachine: "Speed / Brawler",
  elementalTitan: "Brawler / Speed",
  arenaChampion: "Heavy / Mage",
  shadowRogue: "Brawler / Heavy",
  titanGuardian: "Speed / Ranged",
  arcaneEntity: "Brawler / Heavy",
};
const BOSS_REWARD_TIER: Record<BossId, Rarity> = {
  giantBrute: "common",
  shadowAssassin: "rare",
  warMachine: "rare",
  elementalTitan: "legendary",
  arenaChampion: "epic",
  shadowRogue: "rare",
  titanGuardian: "epic",
  arcaneEntity: "epic",
};

// Per-cosmetic display chance within a boss's pool. We assume the cosmetic
// roll fires ~80% of the time when no class drops (factoring guaranteed
// branch + 35% bonus when class did drop) and is split evenly across pool.
const COSMETIC_ROLL_CHANCE = 0.85;

function classDisplayName(id: ClassId): string {
  // Avoid circular import: hard-code common names; fall back to id.
  const names: Partial<Record<ClassId, string>> = {
    samurai: "Samurai", ninja: "Ninja", viking: "Viking", archer: "Archer",
    mage: "Mage", gladiator: "Gladiator", boxer: "Boxer", assassin: "Assassin",
    lightning: "Lightning", executioner: "Executioner", sniper: "Sniper",
    stormMage: "Storm Mage", fireMonk: "Fire Monk", elementalist: "Elementalist",
  };
  return names[id] ?? id;
}

export function getBossInfo(boss: BossId): BossInfo {
  const cfg = BOSS_REWARDS[boss];
  const drops: DropEntry[] = [];

  if (cfg.classUnlock && cfg.classChance > 0) {
    drops.push({
      kind: "class",
      id: cfg.classUnlock,
      label: `${classDisplayName(cfg.classUnlock)} Class`,
      chance: cfg.classChance,
      rarity: cfg.classUnlock === "elementalist" ? "legendary" : "epic",
    });
  }

  const perCosmetic = cfg.cosmeticPool.length
    ? COSMETIC_ROLL_CHANCE / cfg.cosmeticPool.length
    : 0;
  for (const cid of cfg.cosmeticPool) {
    const cos = COSMETICS.find(c => c.id === cid);
    if (!cos) continue;
    drops.push({
      kind: "cosmetic",
      id: cos.id,
      label: cos.name,
      chance: perCosmetic,
      rarity: cos.rarity,
      color: cos.color,
    });
  }
  // Sort by rarity (legendary first), then by chance asc (rarer = lower chance)
  const order: Rarity[] = ["legendary", "epic", "rare", "common"];
  drops.sort((a, b) => {
    const r = order.indexOf(a.rarity) - order.indexOf(b.rarity);
    if (r !== 0) return r;
    return a.chance - b.chance;
  });

  // Always-guaranteed reward last
  drops.push({
    kind: "currency",
    label: `${cfg.currency} Coins + ${cfg.xp} XP`,
    chance: 1,
    rarity: "common",
  });

  return {
    id: boss,
    difficulty: BOSS_DIFFICULTY[boss],
    recommended: BOSS_RECOMMENDED[boss],
    rewardTier: BOSS_REWARD_TIER[boss],
    drops,
  };
}

const CLASS_RATINGS: Record<ClassId, { strength: Rating; speed: Rating; difficulty: Rating }> = {
  fisherman: { strength: 'Medium', speed: 'Medium', difficulty: 'High' },
  samurai:      { strength: "High",      speed: "Medium",    difficulty: "Medium" },
  ninja:        { strength: "Low",       speed: "Very High", difficulty: "Medium" },
  viking:       { strength: "Very High", speed: "Low",       difficulty: "Low" },
  archer:       { strength: "Medium",    speed: "Medium",    difficulty: "Medium" },
  mage:         { strength: "Medium",    speed: "Medium",    difficulty: "Medium" },
  gladiator:    { strength: "High",      speed: "Medium",    difficulty: "Medium" },
  boxer:        { strength: "Medium",    speed: "High",      difficulty: "Medium" },
  assassin:     { strength: "Medium",    speed: "Very High", difficulty: "High" },
  lightning:    { strength: "Low",       speed: "Very High", difficulty: "High" },
  executioner:  { strength: "Very High", speed: "Low",       difficulty: "Medium" },
  sniper:       { strength: "Medium",    speed: "Medium",    difficulty: "High" },
  stormMage:    { strength: "Medium",    speed: "Medium",    difficulty: "High" },
  fireMonk:     { strength: "High",      speed: "High",      difficulty: "Medium" },
  elementalist: { strength: "High",      speed: "Medium",    difficulty: "Very High" },
};

export function getClassRatings(id: ClassId) {
  return CLASS_RATINGS[id] ?? { strength: "Medium" as Rating, speed: "Medium" as Rating, difficulty: "Medium" as Rating };
}

/** Return all bosses that can drop the given class, with chances. */
export function getUnlockSources(classId: ClassId): { bossId: BossId; chance: number }[] {
  const out: { bossId: BossId; chance: number }[] = [];
  for (const [bid, cfg] of Object.entries(BOSS_REWARDS) as [BossId, BossReward][]) {
    if (cfg.classUnlock === classId && cfg.classChance > 0) {
      out.push({ bossId: bid, chance: cfg.classChance });
    }
  }
  return out;
}

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  Easy: "#7df0c0",
  Medium: "#ffe24a",
  Hard: "#ff9f5a",
  Extreme: "#ff6fae",
};
export const RATING_COLOR: Record<Rating, string> = {
  "Low": "#9ad",
  "Medium": "#ffe24a",
  "High": "#ff9f5a",
  "Very High": "#ff6fae",
};

export function formatChance(c: number): string {
  if (c >= 1) return "Guaranteed";
  const pct = c * 100;
  if (pct < 1) return pct.toFixed(2) + "%";
  if (pct < 10) return pct.toFixed(1) + "%";
  return Math.round(pct) + "%";
}
