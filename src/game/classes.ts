// Class & Boss definitions. Each fighter has 4 ability slots (1-4).
// Slot 1 = quick, 2 = combo extender, 3 = mobility/defense, 4 = ultimate.

export type Category = "brawler" | "speed" | "heavy" | "ranged" | "mage";
export type ClassId =
  | "samurai" | "ninja" | "viking" | "archer" | "mage"
  | "gladiator" | "boxer" | "assassin" | "lightning"
  | "executioner" | "sniper" | "stormMage" | "fireMonk"
  | "elementalist" | "fisherman";
export type BossId =
  | "giantBrute" | "shadowAssassin" | "warMachine" | "elementalTitan"
  | "arenaChampion" | "shadowRogue" | "titanGuardian" | "arcaneEntity";
export type FighterId = ClassId | BossId;

// Ability identifiers — each maps to logic in engine startAbility()
export type AbilityId =
  // Samurai
  | "fastSlash" | "dashStrike" | "counterStance" | "rapidFlurry"
  // Ninja
  | "shadowTeleport" | "smokeBomb" | "multiDash" | "cloneBarrage"
  // Viking
  | "axeThrow" | "groundSlam" | "rageBoost" | "berserker"
  // Archer
  | "quickShot" | "multiArrow" | "backflip" | "rainOfArrows"
  // Mage
  | "energyBolt" | "freezeSpell" | "teleport" | "meteor"
  // Gladiator
  | "hookPunch" | "shieldBash" | "guardBreakDash" | "executionSlam"
  // Boxer
  | "jabCombo" | "uppercutLauncher" | "slipDodge" | "rapidFlurryBarrage"
  // Assassin
  | "daggerStrike" | "teleportStab" | "smokeVanish" | "multiAssassin"
  // Lightning Fighter
  | "quickDashStrike" | "electricExtender" | "lightningStep" | "speedStorm"
  // Executioner
  | "axeSwing" | "hookPull" | "armorStance" | "guillotineSlam"
  // Sniper
  | "snipeShot" | "piercingBullet" | "rollDodge" | "focusBeam"
  // Storm Mage
  | "windBlast" | "lightningChain" | "teleportBurst" | "stormSummon"
  // Fire Monk
  | "flameStrike" | "fireDash" | "heatShield" | "dragonFlame"
  // Elementalist (cycles between 3 elements; abilities have fire/ice/lightning variants
  // resolved at cast time inside engine)
  | "elementBlast" | "elementCombo" | "elementMobility" | "elementUlt"
  | "elementSwap"
  | "fishHook" | "catchOfDay" | "freshCatch" | "seaBeast"
  // Boss-only
  | "brutePunch" | "bruteSlam" | "bruteRoar" | "bruteRush"
  | "shadowBlink" | "shadowCounter" | "shadowMulti" | "shadowVoid"
  | "rocket" | "minigun" | "shield" | "missileRain"
  | "fireball" | "iceLance" | "phaseSwap" | "elementalNova"
  // New bosses
  | "championCharge" | "championExecute" | "championRoar" | "championBarrage"
  | "rogueShadowStep" | "rogueDaggerStorm" | "rogueVanish" | "rogueDeathmark"
  | "titanQuake" | "titanSweep" | "titanBulwark" | "titanCataclysm"
  | "arcaneOrb" | "arcaneFreeze" | "arcaneRift" | "arcaneSupernova";

export interface AbilityDef {
  id: AbilityId;
  name: string;
  icon: string;        // emoji shown on slot
  cooldown: number;    // seconds
}

export type WeaponId =
  | "katana" | "kunai" | "fists" | "bow" | "axe" | "staff"
  | "shadowBlade" | "bruteFists" | "cannon" | "elementalStaff"
  | "gladius" | "boxingGloves" | "twinDaggers" | "lightningGauntlets"
  | "execAxe" | "rifle" | "stormStaff" | "fireFists"
  | "elementOrb" | "fishingRod";

export interface ClassDef {
  id: FighterId;
  name: string;
  category: Category;
  blurb: string;
  color: string;
  speedMul: number;
  comboSpeedMul: number; // lower = faster
  damageMul: number;
  knockbackMul: number;
  hp: number;
  abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef];
  isBoss?: boolean;
  weapon?: WeaponId;        // primary weapon shown in hand
  altWeapon?: WeaponId;     // optional alt (e.g., ninja kunai vs fists)
}

const A = (id: AbilityId, name: string, icon: string, cooldown: number): AbilityDef =>
  ({ id, name, icon, cooldown });

export const CLASSES: Record<ClassId, ClassDef> = {
  fisherman: {
    id: 'fisherman', name: 'FISHERMAN', category: 'ranged', color: '#70dfd5',
    blurb: 'An ocean under reality. Reel, retrieve, unleash.',
    speedMul: .96, comboSpeedMul: 1.02, damageMul: 1, knockbackMul: 1, hp: 110, weapon: 'fishingRod',
    abilities: [A('fishHook', 'Hook, Line & Sinker', '🪝', 6), A('catchOfDay', 'Catch of the Day', '🐟', 5),
      A('freshCatch', 'Fresh Catch', '💚', 18), A('seaBeast', "Something’s Biting!", '🦈', 22)],
  },
  samurai: {
    id: "samurai", name: "SAMURAI", category: "brawler",
    blurb: "Disciplined blade. Counters punish.",
    color: "#8ab4ff",
    speedMul: 1.0, comboSpeedMul: 0.95, damageMul: 1.05, knockbackMul: 1.05, hp: 115,
    weapon: "katana",
    abilities: [
      A("fastSlash",     "Fast Slash",      "⚔️", 2.5),
      A("dashStrike",    "Dash Strike",     "💨", 4),
      A("counterStance", "Counter Stance",  "🛡️", 6),
      A("rapidFlurry",   "Rapid Flurry",    "🌀", 9),
    ],
  },
  ninja: {
    id: "ninja", name: "NINJA", category: "speed",
    blurb: "Blink, vanish, overwhelm.",
    color: "#7df0c0",
    speedMul: 1.18, comboSpeedMul: 0.78, damageMul: 0.82, knockbackMul: 0.85, hp: 90,
    weapon: "kunai", altWeapon: "fists",
    abilities: [
      A("shadowTeleport", "Shadow Strike",  "🌑", 3.5),
      A("smokeBomb",      "Smoke Bomb",     "💨", 6),
      A("multiDash",      "Multi-Dash",     "⚡", 4),
      A("cloneBarrage",   "Clone Barrage",  "👥", 10),
    ],
  },
  viking: {
    id: "viking", name: "VIKING", category: "heavy",
    blurb: "Slow. Rage. Smash.",
    color: "#ff7a8a",
    speedMul: 0.85, comboSpeedMul: 1.22, damageMul: 1.45, knockbackMul: 1.4, hp: 140,
    weapon: "axe", altWeapon: "fists",
    abilities: [
      A("axeThrow",   "Axe Throw",       "🪓", 4),
      A("groundSlam", "Ground Slam",     "💥", 6),
      A("rageBoost",  "Rage Boost",      "🔥", 9),
      A("berserker",  "Berserker Mode",  "🩸", 14),
    ],
  },
  archer: {
    id: "archer", name: "ARCHER", category: "ranged",
    blurb: "Spacing king. Punishes approach.",
    color: "#c9a37a",
    speedMul: 1.05, comboSpeedMul: 1.0, damageMul: 0.9, knockbackMul: 0.9, hp: 95,
    weapon: "bow",
    abilities: [
      A("quickShot",     "Quick Shot",     "🏹", 1.6),
      A("multiArrow",    "Triple Shot",    "🎯", 4),
      A("backflip",      "Backflip",       "🤸", 3.5),
      A("rainOfArrows",  "Rain of Arrows", "☔", 11),
    ],
  },
  mage: {
    id: "mage", name: "MAGE", category: "mage",
    blurb: "Control space. Punish freely.",
    color: "#c79bff",
    speedMul: 0.95, comboSpeedMul: 1.05, damageMul: 1.0, knockbackMul: 1.0, hp: 100,
    weapon: "staff",
    abilities: [
      A("energyBolt",  "Energy Bolt",    "✨", 2),
      A("freezeSpell", "Freeze",         "❄️", 6),
      A("teleport",    "Teleport",       "🌀", 5),
      A("meteor",      "Meteor",         "☄️", 12),
    ],
  },
  gladiator: {
    id: "gladiator", name: "GLADIATOR", category: "brawler",
    blurb: "Arena chains. Stagger then crush.",
    color: "#e0b070",
    speedMul: 0.96, comboSpeedMul: 1.0, damageMul: 1.15, knockbackMul: 1.15, hp: 130,
    weapon: "gladius",
    abilities: [
      A("hookPunch",       "Hook Punch",      "👊", 2.2),
      A("shieldBash",      "Shield Bash",     "🛡️", 4.5),
      A("guardBreakDash",  "Guard Break",     "⚡", 5),
      A("executionSlam",   "Execution Slam",  "💀", 11),
    ],
  },
  boxer: {
    id: "boxer", name: "BOXER", category: "brawler",
    blurb: "Pressure. Slip. Counter.",
    color: "#ff9f5a",
    speedMul: 1.08, comboSpeedMul: 0.82, damageMul: 0.95, knockbackMul: 1.0, hp: 105,
    weapon: "boxingGloves",
    abilities: [
      A("jabCombo",            "Jab Combo",       "🥊", 2),
      A("uppercutLauncher",    "Uppercut",        "⬆️", 4),
      A("slipDodge",           "Slip Dodge",      "💨", 3),
      A("rapidFlurryBarrage",  "Flurry Barrage",  "🌀", 9),
    ],
  },
  assassin: {
    id: "assassin", name: "ASSASSIN", category: "speed",
    blurb: "Burst. Vanish. Repeat.",
    color: "#a8f0d0",
    speedMul: 1.22, comboSpeedMul: 0.78, damageMul: 0.92, knockbackMul: 0.85, hp: 88,
    weapon: "twinDaggers",
    abilities: [
      A("daggerStrike",  "Dagger Strike",   "🗡️", 1.8),
      A("teleportStab",  "Teleport Stab",   "🌑", 4),
      A("smokeVanish",   "Smoke Vanish",    "💨", 6),
      A("multiAssassin", "Death Burst",     "☠️", 11),
    ],
  },
  lightning: {
    id: "lightning", name: "LIGHTNING", category: "speed",
    blurb: "Pure speed. Chained sparks.",
    color: "#ffe24a",
    speedMul: 1.25, comboSpeedMul: 0.74, damageMul: 0.85, knockbackMul: 0.9, hp: 92,
    weapon: "lightningGauntlets",
    abilities: [
      A("quickDashStrike",  "Spark Dash",     "⚡", 2),
      A("electricExtender", "Volt Combo",     "🔌", 4),
      A("lightningStep",    "Light Step",     "💨", 4),
      A("speedStorm",       "Speed Storm",    "🌩️", 11),
    ],
  },
  executioner: {
    id: "executioner", name: "EXECUTIONER", category: "heavy",
    blurb: "Slow. Fatal. No retreat.",
    color: "#a44060",
    speedMul: 0.78, comboSpeedMul: 1.28, damageMul: 1.55, knockbackMul: 1.5, hp: 155,
    weapon: "execAxe",
    abilities: [
      A("axeSwing",        "Axe Swing",       "🪓", 3),
      A("hookPull",        "Hook Pull",       "🪝", 5),
      A("armorStance",     "Armor Stance",    "🛡️", 8),
      A("guillotineSlam",  "Guillotine",      "🗡️", 13),
    ],
  },
  sniper: {
    id: "sniper", name: "SNIPER", category: "ranged",
    blurb: "One shot. One read.",
    color: "#9adfff",
    speedMul: 0.98, comboSpeedMul: 1.05, damageMul: 0.95, knockbackMul: 0.95, hp: 90,
    weapon: "rifle",
    abilities: [
      A("snipeShot",       "Quick Shot",     "🎯", 1.5),
      A("piercingBullet",  "Piercing Shot",  "🔫", 4),
      A("rollDodge",       "Roll Dodge",     "🤸", 3.5),
      A("focusBeam",       "Focus Beam",     "✨", 11),
    ],
  },
  stormMage: {
    id: "stormMage", name: "STORM MAGE", category: "mage",
    blurb: "AoE pressure. Pulls and shocks.",
    color: "#7bb6ff",
    speedMul: 0.94, comboSpeedMul: 1.05, damageMul: 1.0, knockbackMul: 1.05, hp: 100,
    weapon: "stormStaff",
    abilities: [
      A("windBlast",      "Wind Blast",     "🌬️", 2.5),
      A("lightningChain", "Chain Lightning","⚡", 5),
      A("teleportBurst",  "Teleport Burst", "🌀", 5),
      A("stormSummon",    "Storm Summon",   "🌪️", 12),
    ],
  },
  fireMonk: {
    id: "fireMonk", name: "FIRE MONK", category: "mage",
    blurb: "Close-range flames. Burn through.",
    color: "#ff7050",
    speedMul: 1.05, comboSpeedMul: 0.92, damageMul: 1.05, knockbackMul: 1.0, hp: 105,
    weapon: "fireFists",
    abilities: [
      A("flameStrike",  "Flame Strike",   "🔥", 2.2),
      A("fireDash",     "Fire Dash",      "💨", 4),
      A("heatShield",   "Heat Shield",    "🛡️", 7),
      A("dragonFlame",  "Dragon Flame",   "🐉", 12),
    ],
  },
  elementalist: {
    id: "elementalist", name: "ELEMENTALIST", category: "mage",
    blurb: "Cycle Fire / Ice / Lightning. Adapt every cast.",
    color: "#ff9bd0",
    speedMul: 1.0, comboSpeedMul: 0.95, damageMul: 1.0, knockbackMul: 1.0, hp: 100,
    weapon: "elementOrb",
    abilities: [
      A("elementBlast",    "Element Blast",   "🔥", 1.8),
      A("elementCombo",    "Element Combo",   "⚡", 4),
      A("elementMobility", "Element Step",    "💨", 3.5),
      A("elementUlt",      "Element Ult",     "🌟", 11),
    ],
  },
};

export const BOSSES: Record<BossId, ClassDef> = {
  giantBrute: {
    id: "giantBrute", name: "GIANT BRUTE", category: "heavy",
    blurb: "Massive. Slow. Devastating.",
    color: "#e85a3c",
    speedMul: 0.7, comboSpeedMul: 1.4, damageMul: 1.7, knockbackMul: 1.6, hp: 320,
    isBoss: true,
    weapon: "bruteFists",
    abilities: [
      A("brutePunch", "Brute Punch", "👊", 2.5),
      A("bruteRush",  "Bull Rush",   "💢", 5),
      A("bruteSlam",  "Quake Slam",  "💥", 6),
      A("bruteRoar",  "War Roar",    "📢", 10),
    ],
  },
  shadowAssassin: {
    id: "shadowAssassin", name: "SHADOW ASSASSIN", category: "speed",
    blurb: "Teleports. Counters. Deletes.",
    color: "#9f7dff",
    speedMul: 1.25, comboSpeedMul: 0.7, damageMul: 1.1, knockbackMul: 0.9, hp: 220,
    isBoss: true,
    weapon: "shadowBlade",
    abilities: [
      A("shadowBlink",   "Blink Strike", "🌑", 2.5),
      A("shadowMulti",   "Shadow Flurry","🗡️", 4),
      A("shadowCounter", "Counter",      "🛡️", 6),
      A("shadowVoid",    "Void Burst",   "🕳️", 10),
    ],
  },
  warMachine: {
    id: "warMachine", name: "WAR MACHINE", category: "ranged",
    blurb: "Ranged barrage. Keep moving.",
    color: "#ffb14d",
    speedMul: 0.85, comboSpeedMul: 1.1, damageMul: 1.2, knockbackMul: 1.1, hp: 280,
    isBoss: true,
    weapon: "cannon",
    abilities: [
      A("minigun",     "Minigun Burst", "🔫", 3),
      A("rocket",      "Rocket",        "🚀", 5),
      A("shield",      "Shield Pulse",  "🛡️", 7),
      A("missileRain", "Missile Rain",  "🎆", 12),
    ],
  },
  elementalTitan: {
    id: "elementalTitan", name: "ELEMENTAL TITAN", category: "mage",
    blurb: "Fire & ice phases. Adapt or die.",
    color: "#ff6fae",
    speedMul: 0.95, comboSpeedMul: 1.05, damageMul: 1.3, knockbackMul: 1.2, hp: 300,
    isBoss: true,
    weapon: "elementalStaff",
    abilities: [
      A("fireball",       "Fireball",      "🔥", 2.2),
      A("iceLance",       "Ice Lance",     "🧊", 3.5),
      A("phaseSwap",      "Phase Swap",    "🔁", 8),
      A("elementalNova",  "Elemental Nova","🌟", 11),
    ],
  },
  arenaChampion: {
    id: "arenaChampion", name: "ARENA CHAMPION", category: "brawler",
    blurb: "Master brawler. Reads your combos.",
    color: "#f0c060",
    speedMul: 1.0, comboSpeedMul: 0.92, damageMul: 1.4, knockbackMul: 1.3, hp: 290,
    isBoss: true,
    weapon: "gladius",
    abilities: [
      A("championCharge",  "Champion Rush",  "💢", 3),
      A("championExecute", "Execute",        "💀", 6),
      A("championRoar",    "War Cry",        "📢", 9),
      A("championBarrage", "Steel Barrage",  "⚔️", 12),
    ],
  },
  shadowRogue: {
    id: "shadowRogue", name: "SHADOW ROGUE", category: "speed",
    blurb: "Strikes from nowhere. Marks your end.",
    color: "#7df0c0",
    speedMul: 1.28, comboSpeedMul: 0.7, damageMul: 1.05, knockbackMul: 0.85, hp: 230,
    isBoss: true,
    weapon: "twinDaggers",
    abilities: [
      A("rogueShadowStep",  "Shadow Step",   "🌑", 2.5),
      A("rogueDaggerStorm", "Dagger Storm",  "🗡️", 5),
      A("rogueVanish",      "Vanish",        "💨", 7),
      A("rogueDeathmark",   "Deathmark",     "☠️", 11),
    ],
  },
  titanGuardian: {
    id: "titanGuardian", name: "TITAN GUARDIAN", category: "heavy",
    blurb: "Walking fortress. Quakes the arena.",
    color: "#a07050",
    speedMul: 0.7, comboSpeedMul: 1.45, damageMul: 1.75, knockbackMul: 1.65, hp: 360,
    isBoss: true,
    weapon: "execAxe",
    abilities: [
      A("titanQuake",     "Titan Quake",    "💥", 4),
      A("titanSweep",     "Sweep",          "🪓", 5),
      A("titanBulwark",   "Bulwark",        "🛡️", 8),
      A("titanCataclysm", "Cataclysm",      "🌋", 14),
    ],
  },
  arcaneEntity: {
    id: "arcaneEntity", name: "ARCANE ENTITY", category: "mage",
    blurb: "Bends space. Reality is its weapon.",
    color: "#c79bff",
    speedMul: 0.96, comboSpeedMul: 1.05, damageMul: 1.3, knockbackMul: 1.15, hp: 310,
    isBoss: true,
    weapon: "stormStaff",
    abilities: [
      A("arcaneOrb",       "Arcane Orb",     "🔮", 2.5),
      A("arcaneFreeze",    "Time Freeze",    "❄️", 5),
      A("arcaneRift",      "Rift Step",      "🌀", 6),
      A("arcaneSupernova", "Supernova",      "🌟", 12),
    ],
  },
};

export const ALL_FIGHTERS: Record<FighterId, ClassDef> = { ...CLASSES, ...BOSSES };

export const CLASS_ORDER: ClassId[] = [
  "fisherman",
  "samurai", "gladiator", "boxer",
  "ninja", "assassin", "lightning",
  "viking", "executioner",
  "archer", "sniper",
  "mage", "stormMage", "fireMonk", "elementalist",
];
export const BOSS_ORDER: BossId[] = [
  "giantBrute", "shadowAssassin", "warMachine", "elementalTitan",
  "arenaChampion", "shadowRogue", "titanGuardian", "arcaneEntity",
];
