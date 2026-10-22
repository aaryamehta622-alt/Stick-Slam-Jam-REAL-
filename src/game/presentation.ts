import type { GameState } from './engine';
import type { Fighter } from './types';
import type { MoveVFX } from './vfx-types';
import { ParticlePool, drawParticles } from './particles';
import { PARTICLE_BUDGET } from './settings';
import { hexAlpha } from './colors';
import { ABILITY_DESIGNS, designFor } from './vfx/designs';
import type { AbilityId } from './classes';
import { drawImpactBursts, type ImpactVFX } from './vfx/impacts';
import { sfx } from './sfx';

export interface Cinematic { age: number; duration: number; color: string; label: string; owner: 'player' | 'enemy' }
export interface Presentation {
  pool: ParticlePool; cinematic: Cinematic | null; cameraX: number; zoom: number;
  emissionClock: number; lastArea: Set<number>; time: number;
  bursts: ImpactVFX[];
}
export function effects(s: GameState): Presentation {
  return s.presentation ??= { pool: new ParticlePool(s.headless ? 0 : PARTICLE_BUDGET[s.settings?.quality ?? 'high']),
    cinematic: null, cameraX: 600, zoom: 1, emissionClock: 0, lastArea: new Set(), time: 0, bursts: [] };
}
export function fighterColor(f: Fighter, element = f.element) {
  return f.classId === 'elementalist' ? ['#ff7a40', '#aee0ff', '#fff080'][element] : f.klass.color;
}
export function impact(s: GameState, x: number, y: number, dir: number, level: number, color: string, elemental = '',element?:0|1|2) {
  if (s.headless) {
    (s.networkEvents ??= []).push({id: s.eventId = (s.eventId ?? 0) + 1, type: 'impact', x,y,dir,level,color,ability:elemental,element});
    return;
  }
  const world=effects(s),pool=world.pool,big=level>=3;
  const design=ABILITY_DESIGNS[elemental as AbilityId]?designFor(elemental as AbilityId,element):undefined;
  world.bursts.push({born:world.time,life:big?.55:.28,x,y,dir,color,accent:design?.accent??'#fff7de',form:design?.form??(big?'slam':'punch'),power:Math.min(2.3,.55+level*.28),seed:world.time*11});
  if(world.bursts.length>24)world.bursts.splice(0,world.bursts.length-24);
  pool.emit({ x, y, color, count: 5 + level * 3, angle: dir > 0 ? 0 : Math.PI, spread: 1.9,
    speed: 180 + level * 95, gravity: 340, life: 0.25 + level * 0.055, size: 2.6, drag: 1.8 });
  pool.emit({ x, y, color, count: 1, shape: 'flash', speed: 0, gravity: 0, life: 0.1,
    size: 8 + level * 6, growth: 10 });
  pool.emit({ x, y, color, count: 1, shape: 'ring', speed: 0, gravity: 0,
    life: big ? 0.4 : 0.18, size: 4, growth: big ? 100 : 26 });
  if (big) {
    pool.emit({ x, y: 3, color, count: 1, shape: 'ring', speed: 0, gravity: 0, life: 0.45, size: 16, growth: 150, ground: true });
    pool.emit({ x, y: 5, color: '#a4a1b8', count: 6, shape: 'debris', speed: 260, angle: Math.PI / 2,
      spread: 2.4, gravity: 800, size: 5, life: 0.65, ground: true });
    pool.emit({ x, y: y * 0.4, color: '#aab6cf', count: 4, shape: 'smoke', speed: 65, gravity: -30, size: 12, growth: 28, life: 0.6 });
  }
  if (/ice|freeze/i.test(elemental)||design?.form==='frost') pool.emit({ x, y, color: '#aee0ff', count: 10, shape: 'ice', speed: 280, life: 0.55, size: 7 });
  if (/fire|flame|meteor/i.test(elemental)||design?.form==='dragon') pool.emit({ x, y, color: '#ff9a42', count: 12, shape: 'mote', speed: 210, gravity: -90, size: 3, life: 0.7 });
}
export function castEffect(s: GameState, f: Fighter, v: MoveVFX, ultimate: boolean) {
  if (s.headless) {
    (s.networkEvents ??= []).push({id:s.eventId = (s.eventId ?? 0) + 1,type:'cast',move:v,ultimate});
    return;
  }
  const e = effects(s), design=designFor(v.ability,v.element,f.klass.category),color=v.ability==='heavy'?fighterColor(f,v.element):design.color;
  e.pool.emit({ x: f.x, y: f.y + 65, color, count: ultimate ? 32 : 9, shape: 'mote',
    radius: ultimate ? 100 : 32, inward: true, speed: ultimate ? 160 : 75, gravity: 0, life: 0.42, size: ultimate ? 4 : 2 });
  if (ultimate) {
    e.cinematic = { age: 0, duration: 1.25, color,
      label: f.klass.abilities.find(a => a.id === v.ability)?.name ?? 'FULL CHARGE', owner: f.id };
    e.pool.emit({ x: f.x, y: f.y + 65, color, count: 2, shape: 'ring', speed: 0, gravity: 0, life: 0.65, size: 16, growth: 140 });
  }
}
export function updatePresentation(s: GameState, dt: number, emit = true) {
  if (s.headless) return;
  const e = effects(s); e.time += dt; e.pool.update(dt);
  let write=0;for(let i=0;i<e.bursts.length;i++){const burst=e.bursts[i];if(e.time-burst.born<burst.life)e.bursts[write++]=burst;}e.bursts.length=write;
  if (e.cinematic) { e.cinematic.age += dt; if (e.cinematic.age >= e.cinematic.duration) e.cinematic = null; }
  const reduced = s.settings?.reducedMotion;
  const envelope = e.cinematic ? Math.sin(Math.PI * e.cinematic.age / e.cinematic.duration) : 0;
  const span = Math.abs(s.player.x - s.enemy.x);
  const targetZoom = reduced ? 1 : Math.max(1, Math.min(1.045 + envelope * 0.055, 1080 / Math.max(1000, span + 160)));
  const follow = 1 - Math.exp(-dt * 5);
  e.zoom += (targetZoom - e.zoom) * follow;
  const half = 600 / e.zoom;
  const targetX = Math.max(half, Math.min(1200 - half, (s.player.x + s.enemy.x) / 2));
  e.cameraX += (targetX - e.cameraX) * follow;
  if (!emit) return;
  e.emissionClock += dt;
  if (e.emissionClock < 1 / 30) return;
  e.emissionClock %= 1 / 30;
  for (const f of [s.player, s.enemy]) {
    const color = fighterColor(f);
    if (f.heavyCharging || f.berserk > 0 || f.rage > 0) e.pool.emit({ x: f.x, y: f.y + 55, color,
      count: f.heavyCharging ? 2 : 1, shape: 'mote', radius: 50, inward: f.heavyCharging,
      speed: f.heavyCharging ? 100 : 25, gravity: -60, life: 0.4, size: 2.6 });
    if (Math.abs(f.vx) > 600) e.pool.emit({ x: f.x, y: f.y + 40, color, count: 2,
      angle: f.vx > 0 ? Math.PI : 0, spread: 0.4, speed: 240, gravity: 0, life: 0.25, size: 2.2 });
  }
  for (const p of s.projectiles) {
    if (s.time < p.born + (p.delay ?? 0) || p.hit) continue;
    e.pool.emit({ x: p.x, y: p.y, color: p.color, count: p.kind === 'meteor' ? 3 : 1,
      shape: p.kind === 'ice' ? 'ice' : 'mote', angle: Math.atan2(-p.vy, -p.vx), spread: 0.5,
      speed: 45, gravity: p.kind === 'fire' ? -50 : 0, life: 0.3, size: p.kind === 'meteor' ? 5 : 2 });
  }
  for (const z of s.aoeZones) {
    if (s.time < z.born + z.delay || e.lastArea.has(z.id)) continue;
    e.lastArea.add(z.id);
    if(z.kind==='sea'){sfx.splash();sfx.finisher();}
    impact(s, z.x, z.y + 15, 1, z.damage > 15 ? 4 : 3, z.color, z.visualAbility ?? z.kind,z.visualElement);
  }
  // Retain only live area IDs so long matches never grow an unbounded event set.
  for (const id of e.lastArea) if (!s.aoeZones.some(z => z.id === id)) e.lastArea.delete(id);
}
export function drawAtmosphere(c: CanvasRenderingContext2D, s: GameState, ground: number) {
  const e = s.presentation; if (!e) return;
  if (e.cinematic) {
    const t = e.cinematic.age / e.cinematic.duration, strength = Math.sin(t * Math.PI);
    c.fillStyle = `rgba(2,4,14,${strength * (s.settings?.reducedMotion ? 0.12 : 0.36)})`; c.fillRect(0, 0, 1200, 540);
    const f = e.cinematic.owner === 'player' ? s.player : s.enemy;
    const g = c.createRadialGradient(f.x, ground-f.y-60, 10, f.x, ground-f.y-60, 330);
    g.addColorStop(0, hexAlpha(e.cinematic.color, strength * 0.23)); g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.fillRect(0, 0, 1200, 540);
    if (!s.settings?.reducedMotion) {
      c.strokeStyle = hexAlpha(e.cinematic.color, strength * 0.24); c.lineWidth = 1;
      for (let i=0;i<22;i++) {
        const a=i*Math.PI*2/22, r=200+(i%4)*20;
        c.beginPath(); c.moveTo(f.x+Math.cos(a)*r, ground-70+Math.sin(a)*r);
        c.lineTo(f.x+Math.cos(a)*900,ground-70+Math.sin(a)*700); c.stroke();
      }
    }
  }
  drawParticles(c, e.pool, ground, false);
}
export function drawEnergy(c: CanvasRenderingContext2D, s: GameState, ground: number) {
  if (s.presentation) {
    drawParticles(c,s.presentation.pool,ground,true);
    drawImpactBursts(c,s.presentation.bursts,s.presentation.time,ground,s.settings?.quality==='low'?.5:s.settings?.quality==='medium'?.75:1);
  }
}
export function drawCinematicHUD(c: CanvasRenderingContext2D, s: GameState) {
  const event=s.presentation?.cinematic; if (!event) return;
  const fade=Math.min(1,event.age*8,(event.duration-event.age)*5);
  c.save(); c.globalAlpha=fade; c.fillStyle=event.color; c.font='800 12px ui-monospace,monospace';
  c.textAlign='center'; c.fillText(event.owner==='enemy' ? 'INCOMING SPECIAL' : 'LIMIT RELEASE',600,178);
  c.fillStyle='#ffffff'; c.font='900 24px system-ui,sans-serif'; c.fillText(event.label.toUpperCase(),600,207); c.restore();
}
