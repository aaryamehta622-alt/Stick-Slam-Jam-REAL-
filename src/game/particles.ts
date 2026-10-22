// Presentation-only pooled emitters. No damage, collision, or cooldown logic lives here.
export type ParticleShape = 'spark' | 'mote' | 'smoke' | 'debris' | 'ice' | 'ring' | 'flash';
export interface EnergyParticle {
  x: number; y: number; vx: number; vy: number; ax: number; ay: number;
  age: number; life: number; size: number; growth: number; drag: number;
  rotation: number; spin: number; color: string; shape: ParticleShape; ground: boolean;
}
export interface Emitter {
  x: number; y: number; color: string; count: number; shape?: ParticleShape;
  angle?: number; spread?: number; speed?: number; gravity?: number; life?: number;
  size?: number; growth?: number; drag?: number; radius?: number; inward?: boolean; ground?: boolean;
}
const TAU = Math.PI * 2;
export class ParticlePool {
  readonly particles: EnergyParticle[];
  readonly active: number[] = [];
  private readonly free: number[] = [];
  dropped = 0;
  constructor(readonly capacity = 720) {
    this.particles = Array.from({ length: capacity }, (_, i) => {
      this.free.push(capacity - 1 - i);
      return { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, age: 0, life: 1, size: 1,
        growth: 0, drag: 0, rotation: 0, spin: 0, color: '#ffffff', shape: 'spark', ground: false };
    });
  }
  emit(e: Emitter) {
    for (let i = 0; i < e.count; i++) {
      const index = this.free.pop();
      if (index === undefined) { this.dropped += e.count - i; break; }
      const p = this.particles[index];
      const a = (e.angle ?? 0) + (Math.random() - 0.5) * (e.spread ?? TAU);
      const speed = (e.speed ?? 220) * (0.4 + Math.random() * 0.6);
      const radius = e.radius ?? 0, sign = e.inward ? -1 : 1;
      p.x = e.x + Math.cos(a) * radius; p.y = e.y + Math.sin(a) * radius;
      p.vx = Math.cos(a) * speed * sign; p.vy = Math.sin(a) * speed * sign;
      p.ax = 0; p.ay = -(e.gravity ?? 380); p.age = 0;
      p.life = (e.life ?? 0.5) * (0.75 + Math.random() * 0.25);
      p.size = (e.size ?? 3) * (0.6 + Math.random() * 0.4);
      p.growth = e.growth ?? 0; p.drag = e.drag ?? 2;
      p.rotation = a; p.spin = (Math.random() - 0.5) * 12;
      p.color = e.color; p.shape = e.shape ?? 'spark'; p.ground = e.ground ?? false;
      this.active.push(index);
    }
  }
  update(dt: number) {
    dt = Math.max(0, Math.min(0.05, dt));
    for (let i = this.active.length - 1; i >= 0; i--) {
      const index = this.active[i], p = this.particles[index];
      p.age += dt;
      if (p.age >= p.life) {
        this.free.push(index); this.active[i] = this.active[this.active.length - 1]; this.active.pop(); continue;
      }
      const damping = Math.exp(-p.drag * dt);
      p.vx = (p.vx + p.ax * dt) * damping; p.vy = (p.vy + p.ay * dt) * damping;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rotation += p.spin * dt;
      if (p.ground && p.y < 2) { p.y = 2; p.vy = Math.abs(p.vy) * 0.32; p.vx *= 0.7; }
    }
  }
}

// Cache small procedural glow stamps, avoiding per-particle blur filters/gradients.
const stamps = new Map<string, HTMLCanvasElement>();
export function glow(color: string) {
  let stamp = stamps.get(color);
  if (!stamp) {
    stamp = document.createElement('canvas'); stamp.width = stamp.height = 64;
    const c = stamp.getContext('2d')!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.12, color); g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    if (stamps.size >= 48) stamps.delete(stamps.keys().next().value!);
    stamps.set(color, stamp);
  }
  return stamp;
}
export function drawParticles(c: CanvasRenderingContext2D, pool: ParticlePool, ground: number, additive: boolean) {
  c.save(); c.globalCompositeOperation = additive ? 'lighter' : 'source-over'; c.lineCap = 'round';
  for (const index of pool.active) {
    const p = pool.particles[index];
    const soft = p.shape === 'smoke' || p.shape === 'debris' || p.shape === 'ice';
    if (additive === soft) continue;
    const t = p.age / p.life, fade = Math.pow(1 - t, 1.5);
    const size = Math.max(0.1, p.size + p.growth * t), x = p.x, y = ground - p.y;
    c.globalAlpha = fade; c.strokeStyle = c.fillStyle = p.color;
    if (p.shape === 'ring') {
      c.lineWidth = 1 + 3 * fade; c.beginPath(); c.ellipse(x, y, size, p.ground ? size * 0.25 : size, 0, 0, TAU); c.stroke();
    } else if (p.shape === 'flash') {
      c.drawImage(glow(p.color), x - size * 2, y - size * 2, size * 4, size * 4);
      c.save(); c.translate(x, y); c.rotate(p.rotation); c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(-size, 0); c.lineTo(-3, -3); c.lineTo(0, -size * 0.65);
      c.lineTo(3, -3); c.lineTo(size, 0); c.lineTo(3, 3); c.lineTo(0, size * 0.65); c.lineTo(-3, 3); c.fill(); c.restore();
    } else if (p.shape === 'smoke') {
      c.globalAlpha = fade * 0.13; c.beginPath(); c.arc(x, y, size, 0, TAU); c.fill();
    } else if (soft) {
      c.save(); c.translate(x, y); c.rotate(p.rotation);
      c.beginPath(); c.moveTo(-size, 0); c.lineTo(0, -size * 0.55); c.lineTo(size, 0); c.lineTo(0, size * 0.8); c.fill(); c.restore();
    } else {
      if (p.shape === 'mote') c.drawImage(glow(p.color), x-size*3, y-size*3, size*6, size*6);
      c.lineWidth = Math.max(0.5, size * fade); c.beginPath(); c.moveTo(x, y);
      c.lineTo(x - p.vx * 0.035, y + p.vy * 0.035); c.stroke();
      c.fillStyle = '#ffffff'; c.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
    }
  }
  c.restore();
}
