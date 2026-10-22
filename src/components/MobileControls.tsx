import { useCallback } from "react";

type HoldKey = "left" | "right" | "block" | "heavy";
type PressKey = "pickup" | "jump" | "attack" | "dash" | "ability1" | "ability2" | "ability3" | "ability4";

interface Props {
  fishing?: boolean;
  onHold: (k: HoldKey, down: boolean) => void;
  onPress: (k: PressKey) => void;
}

export const MobileControls = ({ onHold, onPress, fishing }: Props) => {
  const hold = useCallback(
    (k: HoldKey) => ({
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        onHold(k, true);
      },
      onPointerUp: (e: React.PointerEvent) => {
        e.preventDefault();
        try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); } catch {}
        onHold(k, false);
      },
      onPointerCancel: (e: React.PointerEvent) => {
        try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); } catch {}
        onHold(k, false);
      },
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    }),
    [onHold]
  );

  const press = useCallback(
    (k: PressKey) => ({
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        onPress(k);
      },
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    }),
    [onPress]
  );

  const btn =
    "select-none touch-none flex items-center justify-center rounded-full bg-card/80 backdrop-blur-md border border-border/70 text-foreground/90 active:bg-primary/70 active:text-primary-foreground transition-colors min-w-[44px] min-h-[44px]";

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Left: movement */}
      <div className="absolute bottom-3 left-2 pointer-events-auto grid grid-cols-2 gap-1">
        <button {...hold("left")} className={`${btn} w-9 h-9 text-sm`} aria-label="Left">◀</button>
        <button {...hold("right")} className={`${btn} w-9 h-9 text-sm`} aria-label="Right">▶</button>
        <button {...hold("block")} className={`${btn} w-9 h-9 text-[9px] font-bold`} aria-label="Block">BLK</button>
        <button {...press("dash")} className={`${btn} w-9 h-9 text-[9px] font-bold`} aria-label="Dash">DSH</button>
      </div>

      {fishing&&<button {...press('pickup')} className={`${btn} absolute bottom-28 left-3 pointer-events-auto px-3 text-xs`} aria-label="Pick up fish">E · PICK UP</button>}
      {/* Right: actions */}
      <div className="absolute bottom-3 right-2 pointer-events-auto grid grid-cols-4 gap-1">
          <button {...press("ability1")} className={`${btn} w-7 h-7 text-[10px] font-bold`}>1</button>
          <button {...press("ability2")} className={`${btn} w-7 h-7 text-[10px] font-bold`}>2</button>
          <button {...press("ability3")} className={`${btn} w-7 h-7 text-[10px] font-bold`}>3</button>
          <button {...press("ability4")} className={`${btn} w-7 h-7 text-[10px] font-bold`}>4</button>
        <button {...hold("heavy")} className={`${btn} w-9 h-9 text-[9px] font-bold`} aria-label="Heavy">HVY</button>
        <button {...press("jump")} className={`${btn} w-10 h-10 text-base`} aria-label="Jump">▲</button>
        <button {...press("attack")} className={`${btn} w-11 h-11 text-[10px] font-bold`} aria-label="Attack">HIT</button>
      </div>
    </div>
  );
};
