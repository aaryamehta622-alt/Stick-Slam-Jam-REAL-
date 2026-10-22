import { useEffect, useRef, useState } from "react";
import { GameState, InputState, makeAI, updateGame, emptyInput, ArenaId } from "@/game/engine";
import { makeFighter, ARENA_W } from "@/game/types";
import { ClassId, BossId, FighterId } from "@/game/classes";
import { render } from "@/game/render";
import { sfx, unlockAudio, setSoundEnabled } from "@/game/sfx";
import { createSaveId,getEquippedFor,getProgress,savePreferences } from "@/game/rewards";
import { MobileControls } from "@/components/MobileControls";
import type { GameSettings } from "@/game/settings";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  settings: GameSettings;
  playerClass: ClassId;
  enemyClass: FighterId;
  arena: ArenaId;
  bossMode: boolean;
  useAltWeapon?: boolean;
  onExit: () => void;
  onPlayerWin?: (claimId:string) => void;
}

function makeInitialState(playerClass: ClassId, enemyClass: FighterId, arena: ArenaId, bossMode: boolean, useAltWeapon: boolean): GameState {
  const player = makeFighter("player", playerClass, ARENA_W * 0.3, 1);
  player.altWeaponSelected = useAltWeapon;
  player.equipped = getEquippedFor(playerClass);
  return {
    player,
    enemy: makeFighter("enemy", enemyClass, ARENA_W * 0.7, -1),
    ai: makeAI(),
    time: 0,
    hitPause: 0,
    shake: 0,
    shakeT: 0,
    particles: [],
    projectiles: [],
    aoeZones: [],
    floats: [],
    winner: null,
    winTime: 0,
    flashScreen: 0,
    playerCombo: 0,
    playerComboTimer: 0,
    enemyCombo: 0,
    enemyComboTimer: 0,
    slowmo: 0,
    globalTimeScale: 1,
    arena,
    bossMode,
  };
}

type ScalarKey = "pickup" | "left" | "right" | "jump" | "attack" | "dash" | "block" | "heavy";
type AbilityKey = "ability1" | "ability2" | "ability3" | "ability4";
type Key = ScalarKey | AbilityKey;

const KEY_MAP: Record<string, Key> = {
  KeyE: "pickup",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "jump",
  KeyA: "left",
  KeyD: "right",
  KeyW: "jump",
  Space: "jump",
  KeyJ: "attack",       // legacy fallback
  KeyK: "heavy",        // legacy fallback
  KeyL: "dash",
  KeyF: "block",        // new: F = block
  KeyS: "block",        // legacy fallback
  ArrowDown: "block",
  ShiftLeft: "dash",
  ShiftRight: "dash",
  Digit1: "ability1",
  Digit2: "ability2",
  Digit3: "ability3",
  Digit4: "ability4",
  Numpad1: "ability1",
  Numpad2: "ability2",
  Numpad3: "ability3",
  Numpad4: "ability4",
};

interface RawInput {
  pickup: boolean;
  left: boolean; right: boolean; jump: boolean; attack: boolean;
  dash: boolean; block: boolean; heavy: boolean;
  ability1: boolean; ability2: boolean; ability3: boolean; ability4: boolean;
}

const emptyRaw = (): RawInput => ({
  pickup: false, left: false, right: false, jump: false, attack: false,
  dash: false, block: false, heavy: false,
  ability1: false, ability2: false, ability3: false, ability4: false,
});

export const StickFightGame = ({ settings, playerClass, enemyClass, arena, bossMode, useAltWeapon = false, onExit, onPlayerWin }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(null!);
  if (!stateRef.current) stateRef.current = { ...makeInitialState(playerClass, enemyClass, arena, bossMode, useAltWeapon), settings };
  const rewardCallback = useRef(onPlayerWin);
  rewardCallback.current = onPlayerWin;
  const claimIdRef = useRef(createSaveId());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const inputRef = useRef<RawInput>(emptyRaw());
  const pressedRef = useRef<{ attack: boolean; dash: boolean; jump: boolean; ab: [boolean, boolean, boolean, boolean] }>({
    attack: false, dash: false, jump: false, ab: [false, false, false, false],
  });
  const heavyReleasedRef = useRef(false);
  const winFiredRef = useRef(false);
  const [hud, setHud] = useState({ fps: 60, particles: 0, hp: stateRef.current.player.hp, enemyHp: stateRef.current.enemy.hp, winner: "" });
  const [paused, setPaused] = useState(false);
  const isMobile = useIsMobile();
  const [touchControls, setTouchControls] = useState(()=>getProgress().preferences.touchControls);

  useEffect(() => {
    stateRef.current = { ...makeInitialState(playerClass, enemyClass, arena, bossMode, useAltWeapon), settings: settingsRef.current };
    setSoundEnabled(settingsRef.current.sound);
    claimIdRef.current = createSaveId();
    winFiredRef.current = false;
    sfx.bell();
  }, [playerClass, enemyClass, arena, bossMode, useAltWeapon]);

  useEffect(() => {
    const onResize = () => {
      const c = canvasRef.current;
      const cont = containerRef.current;
      if (!c || !cont) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cont.clientWidth;
      const h = cont.clientHeight;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = w + "px";
      c.style.height = h + "px";
      const ctx = c.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    onResize();
    const observer = new ResizeObserver(onResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", onResize);
    return () => { observer.disconnect(); window.removeEventListener("resize", onResize); };
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("select,input,textarea,[contenteditable=true]")) return;
      if ((e.target as HTMLElement)?.closest('button') && ['Space', 'Enter'].includes(e.code)) return;
      unlockAudio();
      if (e.repeat && ["KeyP", "KeyR", "Escape"].includes(e.code)) return;
      if (e.code === "KeyR") {
        stateRef.current = { ...makeInitialState(playerClass, enemyClass, arena, bossMode, useAltWeapon), settings: settingsRef.current };
        claimIdRef.current = createSaveId(); setPaused(false);
        winFiredRef.current = false;
        sfx.bell();
        return;
      }
      if (e.code === "KeyP") { setPaused((p) => !p); return; }
      if (e.code === "Escape") { onExit(); return; }
      const k = KEY_MAP[e.code];
      if (!k) return;
      e.preventDefault();
      const prev = inputRef.current[k];
      if (!prev) {
        if (k === "attack") pressedRef.current.attack = true;
        else if (k === "dash") pressedRef.current.dash = true;
        else if (k === "jump") pressedRef.current.jump = true;
        else if (k === "ability1") pressedRef.current.ab[0] = true;
        else if (k === "ability2") pressedRef.current.ab[1] = true;
        else if (k === "ability3") pressedRef.current.ab[2] = true;
        else if (k === "ability4") pressedRef.current.ab[3] = true;
      }
      inputRef.current[k] = true;
    };
    const onUp = (e: KeyboardEvent) => {
      const k = KEY_MAP[e.code];
      if (!k) return;
      e.preventDefault();
      if (k === "heavy" && inputRef.current.heavy) {
        heavyReleasedRef.current = true;
      }
      inputRef.current[k] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [playerClass, enemyClass, arena, bossMode, useAltWeapon, onExit]);

  // Mouse controls: LMB = light attack, RMB = heavy (hold to charge)
  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const onMouseDown = (e: MouseEvent) => {
      unlockAudio();
      if (e.button === 0) {
        e.preventDefault();
        if (!inputRef.current.attack) pressedRef.current.attack = true;
        inputRef.current.attack = true;
      } else if (e.button === 2) {
        e.preventDefault();
        inputRef.current.heavy = true;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        e.preventDefault();
        inputRef.current.attack = false;
      } else if (e.button === 2) {
        e.preventDefault();
        if (inputRef.current.heavy) heavyReleasedRef.current = true;
        inputRef.current.heavy = false;
      }
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    const canvas = canvasRef.current!;
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    cont.addEventListener("contextmenu", onContext);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      cont.removeEventListener("contextmenu", onContext);
    };
  }, []);

  useEffect(() => {
    const reset = () => {
      inputRef.current = emptyRaw(); heavyReleasedRef.current = false;
      pressedRef.current = { attack: false, dash: false, jump: false, ab: [false, false, false, false] };
      stateRef.current.player.heavyCharging = false;
    };
    const background = () => { reset(); if (document.hidden) setPaused(true); };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', background);
    return () => { window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', background); };
  }, []);

  useEffect(() => {
    let raf = 0, last = performance.now(), accumulator = 0, uiTime = 0, fps = 60;
    const loop = (now: number) => {
      const elapsed = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      fps += (1 / Math.max(0.001, elapsed) - fps) * 0.05;
      if (!paused) {
        accumulator += elapsed;
        while (accumulator >= 1 / 120) {
          const r = inputRef.current, p = pressedRef.current;
          const frame: InputState = { pickup: r.pickup, left: r.left, right: r.right, block: r.block,
            jump: p.jump, attack: p.attack, dash: p.dash, abilities: [...p.ab],
            heavyHeld: r.heavy, heavyReleased: heavyReleasedRef.current };
          // Keep button edges until hitstop ends, so inputs never vanish in a freeze frame.
          if (stateRef.current.hitPause <= 0) {
            p.jump = p.attack = p.dash = false; p.ab.fill(false); heavyReleasedRef.current = false; r.pickup = false;
          }
          updateGame(stateRef.current, frame, 1 / 120); accumulator -= 1 / 120;
        }
        const state = stateRef.current;
        if (!winFiredRef.current && state.winner === 'player' && bossMode) {
          winFiredRef.current = true; rewardCallback.current?.(claimIdRef.current);
        }
      } else accumulator = 0;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (ctx) {
          const width = canvas.width / dpr, height = canvas.height / dpr;
          const dock = isMobile || touchControls ? 104 : 0;
          ctx.fillStyle = '#0b0f1b'; ctx.fillRect(0, 0, width, height);
          render({ ctx, state: stateRef.current, width, height: Math.max(1, height - dock) });
        }
      }
      uiTime += elapsed;
      if (uiTime > 0.2) {
        uiTime = 0; const state = stateRef.current;
        setHud({ fps: Math.round(fps), particles: (state.presentation?.pool.active.length ?? 0) + state.particles.length,
          hp: Math.ceil(state.player.hp), enemyHp: Math.ceil(state.enemy.hp), winner: state.winner ?? '' });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, bossMode, isMobile, touchControls]);

  return (
    <div className="relative w-full h-full touch-none" ref={containerRef} data-game="active">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Stick Slam Jam combat arena"
        tabIndex={0}
        className="w-full h-full block rounded-2xl arena-shadow"
        onClick={() => unlockAudio()}
      />
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <button onClick={() => setPaused(false)} className="bg-foreground/85 text-background px-8 py-4 rounded-xl text-2xl font-bold tracking-wide">
            PAUSED · RESUME
          </button>
        </div>
      )}
      <div className="absolute bottom-2 left-3 text-[10px] text-white/35 font-mono pointer-events-none" aria-hidden="true">{hud.fps} FPS · {hud.particles} FX</div>
      <div className="sr-only" role="status">Player HP {hud.hp}. Opponent HP {hud.enemyHp}. {hud.winner && (hud.winner === 'player' ? 'You win' : 'You lose')}</div>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <button className="arena-button" onClick={() => setPaused(p => !p)}>{paused ? 'Resume' : 'Pause'}</button>
        <button className="arena-button" onClick={() => {
          stateRef.current = { ...makeInitialState(playerClass, enemyClass, arena, bossMode, useAltWeapon), settings: settingsRef.current };
          winFiredRef.current = false; claimIdRef.current = createSaveId(); setPaused(false);
        }}>Rematch</button>
        <button className="arena-button" onClick={() => {const next=!touchControls;setTouchControls(next);void savePreferences({touchControls:next});}} aria-pressed={touchControls}>Touch</button>
      </div>
      {(isMobile || touchControls) && (
        <MobileControls fishing={playerClass==='fisherman'}
          onHold={(k, down) => {
            unlockAudio();
            if (k === "heavy") {
              if (!down && inputRef.current.heavy) heavyReleasedRef.current = true;
              inputRef.current.heavy = down;
              return;
            }
            inputRef.current[k] = down;
          }}
          onPress={(k) => {
            unlockAudio();
            if (k === "pickup") inputRef.current.pickup = true;
            else if (k === "attack") pressedRef.current.attack = true;
            else if (k === "jump") pressedRef.current.jump = true;
            else if (k === "dash") pressedRef.current.dash = true;
            else if (k === "ability1") pressedRef.current.ab[0] = true;
            else if (k === "ability2") pressedRef.current.ab[1] = true;
            else if (k === "ability3") pressedRef.current.ab[2] = true;
            else if (k === "ability4") pressedRef.current.ab[3] = true;
          }}
        />
      )}
    </div>
  );
};
