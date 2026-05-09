import { useState, useEffect, useCallback, useRef } from 'react';
import PokeCard from '../components/PokeCard';
import BuiltCard from '../components/BuiltCard';
import { Dashboard } from '../lib/dashboard';
import { sb, getWeeklyScoreboard, getMedalCounts, getWeekEnd } from '../lib/supabase';
import type { Session } from '../lib/auth';
import type { Card } from '../lib/supabase';

type WeeklyProject = {
  id: string;
  teacher_id: string;
  title: string;
  task: string;
  char_hint: string | null;
  card_data: Partial<Card> | null;
  week_label: string | null;
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const RARITY_ICONS: Record<string, string> = {
  common: '☆', silver: '✦', 'gold-rare': '★', prismatic: '✦✦',
};


function rarityCardStyle(rarity: string): React.CSSProperties {
  switch (rarity) {
    case 'gold-rare':
      return { background: 'linear-gradient(145deg, #fff8e1 0%, #ffe082 60%, #ffd54f 100%)', border: '2px solid #ffca28' };
    case 'silver':
      return { background: 'linear-gradient(145deg, #f5f5f5 0%, #e0e0e0 60%, #bdbdbd 100%)', border: '2px solid #b0bec5' };
    case 'prismatic':
      return { background: 'linear-gradient(135deg, #fce4ec, #e8eaf6, #e0f7fa, #f3e5f5, #fce4ec)', border: '2px solid #ce93d8' };
    default:
      return { background: 'linear-gradient(145deg, #fafafa 0%, #f0f4ff 100%)', border: '2px solid #b3c2e8' };
  }
}

/* Base 4 colour themes */
const BASE_COLOR_THEMES = [
  { light: '#e3f2fd', mid: '#90caf9', dark: '#42a5f5', glow: 'rgba(66,165,245,0.35)',   label: 'Sky',       wave: '#42a5f5', waveShadow: 'rgba(66,165,245,0.8)',   special: false },
  { light: '#fce4ec', mid: '#f8bbd0', dark: '#f48fb1', glow: 'rgba(244,143,177,0.35)', label: 'Bubblegum', wave: '#f06292', waveShadow: 'rgba(240,98,146,0.8)',   special: false },
  { light: '#f1f8e9', mid: '#c5e1a5', dark: '#8bc34a', glow: 'rgba(139,195,74,0.35)',  label: 'Minty',     wave: '#66bb6a', waveShadow: 'rgba(102,187,106,0.8)',  special: false },
  { light: '#fffde7', mid: '#fff176', dark: '#fdd835', glow: 'rgba(253,216,53,0.35)',   label: 'Lemon',     wave: '#fdd835', waveShadow: 'rgba(253,216,53,0.8)',   special: false },
];

/* Unlock-able extra colours (2 per unlock tier, then specials) */
const EXTRA_COLOR_THEMES = [
  // Tier 1 (+2 colors, total 6)
  { light: '#f3e5f5', mid: '#ce93d8', dark: '#ab47bc', glow: 'rgba(171,71,188,0.35)',  label: 'Grape',     wave: '#ab47bc', waveShadow: 'rgba(171,71,188,0.8)',   special: false },
  { light: '#e0f7fa', mid: '#80deea', dark: '#00bcd4', glow: 'rgba(0,188,212,0.35)',   label: 'Ocean',     wave: '#00bcd4', waveShadow: 'rgba(0,188,212,0.8)',    special: false },
  // Tier 2 (+2 more, total 8)
  { light: '#fff3e0', mid: '#ffcc80', dark: '#ff9800', glow: 'rgba(255,152,0,0.35)',   label: 'Tangerine', wave: '#ff9800', waveShadow: 'rgba(255,152,0,0.8)',    special: false },
  { light: '#fce4ec', mid: '#ef9a9a', dark: '#e53935', glow: 'rgba(229,57,53,0.35)',   label: 'Crimson',   wave: '#e53935', waveShadow: 'rgba(229,57,53,0.8)',    special: false },
  // Tier 3 — Shiny Gold & Silver (special)
  { light: '#fffde7', mid: '#ffe082', dark: '#ffc107', glow: 'rgba(255,193,7,0.6)',    label: '✨ Gold',    wave: '#ffd700', waveShadow: 'rgba(255,215,0,0.95)',   special: true,  gradient: 'linear-gradient(135deg,#fffbe6,#ffe066,#ffd700,#bfa000,#ffd700,#ffe066)' },
  { light: '#f5f5f5', mid: '#e0e0e0', dark: '#9e9e9e', glow: 'rgba(200,200,200,0.6)', label: '✨ Silver',  wave: '#c0c0c0', waveShadow: 'rgba(192,192,192,0.95)', special: true,  gradient: 'linear-gradient(135deg,#ffffff,#d0d0d0,#a0a0a0,#e8e8e8,#a0a0a0,#d0d0d0)' },
  // Tier 4 — Black Chrome Rainbow (special)
  { light: '#1a1a2e', mid: '#16213e', dark: '#0f3460', glow: 'rgba(100,0,200,0.7)',    label: '🌈 Chrome', wave: '#a855f7', waveShadow: 'rgba(168,85,247,0.95)',   special: true,  gradient: 'linear-gradient(135deg,#ff0080,#ff8c00,#ffe000,#00ff88,#00c8ff,#a855f7,#ff0080)', chromatic: true },
];

/* Face pixel colour palettes — unlockable */
const FACE_COLOR_PALETTES = [
  { label: 'Blue',   on: '#42a5f5', glow: 'rgba(66,165,245,0.8)',   gradient: 'radial-gradient(circle at 40% 35%, #c8f0ff, #6dd5fa)' },
  { label: 'Yellow', on: '#fdd835', glow: 'rgba(253,216,53,0.8)',   gradient: 'radial-gradient(circle at 40% 35%, #fffde7, #ffd600)' },
  { label: 'Green',  on: '#66bb6a', glow: 'rgba(102,187,106,0.8)',  gradient: 'radial-gradient(circle at 40% 35%, #e8f5e9, #43a047)' },
  { label: 'Pink',   on: '#f06292', glow: 'rgba(240,98,146,0.8)',   gradient: 'radial-gradient(circle at 40% 35%, #fce4ec, #e91e63)' },
];

type ColorTheme = {
  light: string; mid: string; dark: string; glow: string;
  label: string; wave: string; waveShadow: string; special: boolean;
  gradient?: string; chromatic?: boolean;
};

function buildColorThemes(unlockedColorCount: number): ColorTheme[] {
  const extras = EXTRA_COLOR_THEMES.slice(0, Math.max(0, unlockedColorCount - 4));
  return [...BASE_COLOR_THEMES, ...extras] as ColorTheme[];
}

function knobToRobotColor(k: number, themes: ColorTheme[]): ColorTheme {
  return themes[k % themes.length];
}

/* How many extra colors unlocked from an array of unlock choices */
function countUnlockedColors(choices: string[]): number {
  return choices.filter(c => c === 'color').length * 2;
}
function countUnlockedFaceColors(choices: string[]): number {
  return choices.filter(c => c === 'face').length;
}

/* ─────────────────────────────────────────────
   Waveform canvas component
───────────────────────────────────────────── */
function Waveform({ colorIndex }: { colorIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const colorRef = useRef(colorIndex);
  colorRef.current = colorIndex;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function draw(ts: number) {
      const W = canvas!.width;
      const H = canvas!.height;
      ctx.clearRect(0, 0, W, H);
      const theme = BASE_COLOR_THEMES[colorRef.current % BASE_COLOR_THEMES.length];

      // Grid lines tinted to current color
      ctx.strokeStyle = theme.wave + '18';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 15) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Glow waveform — color matches theme
      const idx = colorRef.current;
      const speed = 0.0015 + (idx / 4) * 0.003;
      const amp = 18 + (idx / 4) * 20;
      const freq = 1 + (idx / 4) * 3;

      ctx.shadowColor = theme.wave;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = theme.waveShadow;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let px = 0; px < W; px++) {
        const t = (px / W) * Math.PI * 2 * freq + ts * speed;
        const spike = Math.exp(-((px / W - 0.4) ** 2) * 20) * amp * 1.8;
        const y = H / 2 + Math.sin(t) * amp * 0.4 + spike * Math.sin(t * 3);
        px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={120}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

/* ─────────────────────────────────────────────
   Saved Bot Avatar (from Build-a-Bot)
───────────────────────────────────────────── */

type BotElType = 'rect' | 'circle' | 'face' | 'chest' | 'group' | 'apple' | 'smiley' | 'heart' | 'thumbsup' | 'lips';
interface BotEl {
  id: string; type: BotElType; cx: number; cy: number; w: number; h: number;
  rotation: number; rx?: number | string; color: string; scale?: number;
  baseW?: number; baseH?: number; children?: BotEl[]; flipX?: boolean; flipY?: boolean;
}

// The BuildABot canvas is 800×850. The bot content occupies roughly:
// y: 45 (top of antenna ball) → 760 (bottom of legs)  = 715px tall
// x: 55 (left arm edge) → 505 (right arm edge)         = 450px wide
// We scale to match the default RobotAvatar height (~293px).
const BAB_SCALE = 293 / 715;          // ≈ 0.41
const BAB_VIEWPORT_W = Math.round(450 * BAB_SCALE);  // ≈ 184px
const BAB_VIEWPORT_H = Math.round(715 * BAB_SCALE);  // ≈ 293px
const BAB_OFFSET_X   = Math.round(55  * BAB_SCALE);  // left crop offset in display px
const BAB_OFFSET_Y   = Math.round(45  * BAB_SCALE);  // top  crop offset in display px

const STICKER_MAP: Record<string, string> = { apple:'🍎', smiley:'🙂', heart:'❤️', thumbsup:'👍', lips:'👄' };

function renderBotEl(el: BotEl): React.ReactNode {
  const isGroup   = el.type === 'group';
  const isFace    = el.type === 'face';
  const isChest   = el.type === 'chest';
  const isScreen  = isFace || isChest;
  const isCircle  = el.type === 'circle';
  const isSticker = ['apple','smiley','heart','thumbsup','lips'].includes(el.type);

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: el.cx,
    top: el.cy,
    width:  isGroup ? (el.baseW ?? el.w) : el.w,
    height: isGroup ? (el.baseH ?? el.h) : el.h,
    transform: `translate(-50%,-50%) rotate(${el.rotation}deg) scale(${isGroup ? (el.scale ?? 1) : 1}) scaleX(${el.flipX ? -1 : 1}) scaleY(${el.flipY ? -1 : 1})`,
    borderRadius: isCircle ? '50%' : (typeof el.rx === 'number' ? el.rx : 0),
    backgroundColor: (isGroup || isSticker) ? 'transparent' : el.color,
    // Screens get a dark inset glow; normal parts get a neumorphic-lite shadow
    boxShadow: isScreen
      ? 'inset 0 0 14px rgba(0,0,0,0.85)'
      : (!isGroup && !isSticker)
        ? 'inset 6px 6px 12px rgba(255,255,255,0.65), inset -6px -6px 12px rgba(0,0,0,0.06), 8px 8px 16px rgba(0,0,0,0.08)'
        : undefined,
    // Screens must clip their content (eyes / bars); groups must NOT clip
    overflow: isScreen ? 'hidden' : 'visible',
    // Use z-index to mirror BuildABot: screens sit above body parts
    zIndex: isScreen ? 2 : 1,
  };

  const renderScreenContent = (type: string, w: number, h: number) => {
    if (type === 'face') {
      return (
        <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'15%' }}>
          <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
          <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
        </div>
      );
    }
    if (type === 'chest') {
      const fs = Math.round(w * 0.14);
      return (
        <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: Math.round(h * 0.06) }}>
          <span style={{ fontSize: fs, fontWeight:700, color:'#8be9fd', letterSpacing:'0.05em' }}>LVL 5</span>
          <div style={{ width:'75%', height: Math.max(3, Math.round(h * 0.04)), background:'#1f2937', borderRadius:9999, overflow:'hidden' }}>
            <div style={{ width:'66%', height:'100%', background:'linear-gradient(90deg,#60a5fa,#a855f7)', borderRadius:9999 }} />
          </div>
        </div>
      );
    }
    return null;
  };

  const renderChildEl = (c: BotEl, ci: number) => {
    const cIsScreen  = c.type === 'face' || c.type === 'chest';
    const cIsCircle  = c.type === 'circle';
    const cIsSticker = ['apple','smiley','heart','thumbsup','lips'].includes(c.type);
    return (
      <div key={ci} style={{
        position: 'absolute',
        left: '50%', top: '50%',
        width: c.w, height: c.h,
        marginLeft: c.cx, marginTop: c.cy,
        transform: `translate(-50%,-50%) rotate(${c.rotation}deg) scaleX(${c.flipX?-1:1}) scaleY(${c.flipY?-1:1})`,
        backgroundColor: cIsSticker ? 'transparent' : (c.color || el.color),
        borderRadius: cIsCircle ? '50%' : (typeof c.rx === 'number' ? c.rx : 0),
        overflow: cIsScreen ? 'hidden' : 'visible',
        zIndex: cIsScreen ? 2 : 1,
        boxShadow: cIsScreen ? 'inset 0 0 14px rgba(0,0,0,0.85)' : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cIsSticker && <span style={{ fontSize: c.w * 0.7, lineHeight:1 }}>{STICKER_MAP[c.type]}</span>}
        {cIsScreen  && renderScreenContent(c.type, c.w, c.h)}
      </div>
    );
  };

  return (
    <div key={el.id} style={containerStyle}>
      {isGroup   && (el.children ?? []).map((c, ci) => renderChildEl(c, ci))}
      {isSticker && <span style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize: el.w * 0.7, lineHeight:1 }}>{STICKER_MAP[el.type]}</span>}
      {isScreen  && renderScreenContent(el.type, el.w, el.h)}
    </div>
  );
}

function SavedBotAvatar({ facePixels, faceColorPalettes }: { facePixels: string[] | null; faceColorPalettes: typeof FACE_COLOR_PALETTES }) {
  const [botElements, setBotElements] = useState<BotEl[] | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('savedBot');
    if (raw) { try { setBotElements(JSON.parse(raw)); } catch { setBotElements(null); } }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'savedBot') {
        if (e.newValue) { try { setBotElements(JSON.parse(e.newValue)); } catch { setBotElements(null); } }
        else setBotElements(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!botElements) return null;

  // Inject the pixel face into the face-screen element for live display
  const elementsWithPixels = facePixels
    ? botElements.map(el => el.type === 'face' ? { ...el, _facePixels: facePixels, _palettes: faceColorPalettes } : el)
    : botElements;

  // Render face screen content with pixel support (mirrors StudentPage RobotAvatar logic)
  const renderFaceContent = (el: any) => {
    const pixels: string[] | null = el._facePixels ?? null;
    const palettes: typeof FACE_COLOR_PALETTES = el._palettes ?? FACE_COLOR_PALETTES.slice(0,1);
    if (pixels) {
      return (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(20, 1fr)', gap:0, width:'85%', height:'85%' }}>
          {pixels.map((c: string, i: number) => {
            const paletteIdx = c.startsWith('on') ? (parseInt(c.replace('on','') || '0') || 0) : -1;
            const pal = paletteIdx >= 0 ? (palettes[paletteIdx] || palettes[0]) : null;
            return <div key={i} style={{ background: pal ? pal.on : 'transparent', boxShadow: pal ? `0 0 2px ${pal.glow}` : 'none' }} />;
          })}
        </div>
      );
    }
    return (
      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'15%' }}>
        <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
        <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', width: BAB_VIEWPORT_W, flexShrink: 0 }}>
      <style>{`
        @keyframes savedBotBounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .saved-bot-body { animation: savedBotBounce 3s ease-in-out infinite; }
      `}</style>
      {/* Outer clip to the viewport size */}
      <div style={{ width: BAB_VIEWPORT_W, height: BAB_VIEWPORT_H, overflow: 'hidden', position: 'relative' }}>
        {/* Bounce wrapper — bounces the scaled canvas */}
        <div className="saved-bot-body" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          {/* Scale + crop: the full 800×850 canvas scaled down, then offset to crop to the bot */}
          <div style={{
            position: 'absolute',
            width: 800,
            height: 850,
            transform: `scale(${BAB_SCALE})`,
            transformOrigin: 'top left',
            // Offset to crop: shift left/up by the pre-scaled origin so only the bot is visible
            left: -Math.round(55 * BAB_SCALE),   // shift left: removes left padding
            top:  -Math.round(45 * BAB_SCALE),   // shift up: removes top antenna padding
          }}>
            {elementsWithPixels.map((el: any) => {
              // For face elements with pixel data, render a special version
              if (el.type === 'face') {
                const isScreen = true;
                const containerStyle: React.CSSProperties = {
                  position: 'absolute',
                  left: el.cx, top: el.cy,
                  width: el.w, height: el.h,
                  transform: `translate(-50%,-50%) rotate(${el.rotation}deg)`,
                  borderRadius: typeof el.rx === 'number' ? el.rx : 0,
                  backgroundColor: el.color,
                  boxShadow: 'inset 0 0 14px rgba(0,0,0,0.85)',
                  overflow: 'hidden',
                  zIndex: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                };
                return <div key={el.id} style={containerStyle}>{renderFaceContent(el)}</div>;
              }
              return renderBotEl(el);
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Robot avatar
───────────────────────────────────────────── */

function RobotAvatar({ level, xp, xpMax, color, facePixels, faceColorPalettes }: { level: number; xp: number; xpMax: number; color: ColorTheme; facePixels: string[] | null; faceColorPalettes?: typeof FACE_COLOR_PALETTES }) {
  const { light, mid, dark, glow, label } = color;
  const isChromatic = !!(color as any).chromatic;
  const bodyBg = (color as any).gradient
    ? (color as any).gradient
    : `linear-gradient(145deg,${light},${mid})`;
  const palettes = faceColorPalettes || FACE_COLOR_PALETTES.slice(0, 1);
  return (
    <div style={{ position: 'relative', width: 180, flexShrink: 0 }}>
      <style>{`
        @keyframes robotBounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes eyeBlink {
          0%,90%,100% { transform: scaleY(1); }
          95%          { transform: scaleY(0.08); }
        }
        .robot-body { animation: robotBounce 3s ease-in-out infinite; }
        .robot-eye  { animation: eyeBlink 4s ease-in-out infinite; }
      `}</style>

      <div className="robot-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        {/* Antenna */}
        <div style={{ width: 3, height: 22, background: isChromatic ? bodyBg : `linear-gradient(180deg,${mid},${dark})`, borderRadius: 4, marginBottom: -4, transition: 'background 0.6s ease' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: dark, boxShadow: `0 0 10px ${dark}`, transition: 'background 0.6s ease, box-shadow 0.6s ease' }} />

        {/* Head */}
        <div style={{ width: 120, height: 90, background: bodyBg, borderRadius: 24, position: 'relative', boxShadow: `0 8px 24px ${glow}, inset 0 2px 4px rgba(255,255,255,0.6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.6s ease, box-shadow 0.6s ease' }}>
          {/* Face screen */}
          <div style={{ width: 80, height: 52, background: '#0d1117', borderRadius: 12, overflow: 'hidden', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {facePixels ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 0, width: 70, height: 44 }}>
                {facePixels.map((c, i) => {
                  const paletteIdx = c.startsWith('on') ? (parseInt(c.replace('on','') || '0') || 0) : -1;
                  const pal = paletteIdx >= 0 ? (palettes[paletteIdx] || palettes[0]) : null;
                  return <div key={i} style={{ background: pal ? pal.on : '#0d1117', boxShadow: pal ? `0 0 2px ${pal.glow}` : 'none' }} />;
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, width: '100%', height: '100%' }}>
                {[0, 1].map(i => (
                  <div key={i} className="robot-eye" style={{ width: 18, height: 22, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #c8f0ff, #6dd5fa)', boxShadow: '0 0 12px rgba(100,210,255,0.7)', transformOrigin: 'center' }} />
                ))}
              </div>
            )}
          </div>
          {/* Ear nubs */}
          {[-1, 1].map(s => (
            <div key={s} style={{ position: 'absolute', top: '50%', [s === -1 ? 'left' : 'right']: -8, transform: 'translateY(-50%)', width: 10, height: 28, background: `linear-gradient(145deg,${mid},${dark})`, borderRadius: 6, transition: 'background 0.6s ease' }} />
          ))}
        </div>

        {/* Neck */}
        <div style={{ width: 28, height: 12, background: isChromatic ? bodyBg : `linear-gradient(180deg,${mid},${dark})`, borderRadius: 6, transition: 'background 0.6s ease' }} />

        {/* Body */}
        <div style={{ width: 130, height: 110, background: bodyBg, borderRadius: 28, position: 'relative', boxShadow: `0 10px 30px ${glow}, inset 0 2px 4px rgba(255,255,255,0.6)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.6s ease, box-shadow 0.6s ease' }}>
          {/* Arm nubs */}
          {[-1, 1].map(s => (
            <div key={s} style={{ position: 'absolute', top: 20, [s === -1 ? 'left' : 'right']: -14, width: 18, height: 60, background: `linear-gradient(180deg,${mid},${dark})`, borderRadius: 12, transition: 'background 0.6s ease' }} />
          ))}
          {/* Chest screen */}
          <div style={{ width: 88, height: 58, background: '#0d1117', borderRadius: 14, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ color: '#a8e6ff', fontSize: '0.75rem', fontWeight: 800, letterSpacing: 1 }}>LVL {level}</span>
            <span style={{ color: 'rgba(168,230,255,0.6)', fontSize: '0.6rem' }}>{xp} XP</span>
            <div style={{ width: 60, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (xp / xpMax) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#64b5f6,#ab47bc)', borderRadius: 10 }} />
            </div>
          </div>
        </div>

        {/* Legs */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ width: 32, height: 38, background: `linear-gradient(180deg,${mid},${dark})`, borderRadius: '12px 12px 16px 16px', boxShadow: `0 4px 12px ${glow}`, transition: 'background 0.6s ease' }} />
          ))}
        </div>
      </div>

      {/* Color label badge */}
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <span style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.1em', color: dark, textTransform: 'uppercase', opacity: 0.8, transition: 'color 0.6s ease' }}>{label}</span>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────
   Pixel face editor (20×14 grid)
───────────────────────────────────────────── */
const GRID_COLS = 20;
const GRID_ROWS = 14;
const EMPTY_GRID = () => Array(GRID_COLS * GRID_ROWS).fill('off');

function PixelEditor({ faceColorPalettes, onSend, onReset }: {
  faceColorPalettes: typeof FACE_COLOR_PALETTES;
  onSend: (pixels: string[]) => void;
  onReset: () => void;
}) {
  const [grid, setGrid] = useState<string[]>(EMPTY_GRID);
  const [selectedPaletteIdx, setSelectedPaletteIdx] = useState(0);
  const lastTap = useRef<{ idx: number; time: number } | null>(null);
  const activePal = faceColorPalettes[selectedPaletteIdx] || faceColorPalettes[0];
  const waveColor = activePal.on;

  const colorPixel = (i: number) => {
    setGrid(g => { const n = [...g]; n[i] = `on${selectedPaletteIdx}`; return n; });
  };
  const erasePixel = (i: number) => {
    setGrid(g => { const n = [...g]; n[i] = 'off'; return n; });
  };
  const handleClick = (i: number) => { colorPixel(i); };
  const handleDoubleClick = (i: number) => { erasePixel(i); };
  const handleTouchEnd = (e: React.TouchEvent, i: number) => {
    e.preventDefault();
    const now = Date.now();
    if (lastTap.current && lastTap.current.idx === i && now - lastTap.current.time < 350) {
      erasePixel(i); lastTap.current = null;
    } else {
      colorPixel(i); lastTap.current = { idx: i, time: now };
    }
  };
  const clearGrid = () => setGrid(EMPTY_GRID());

  const getCellColor = (cell: string) => {
    if (cell === 'off') return 'rgba(255,255,255,0.04)';
    const idx = parseInt(cell.replace('on','') || '0') || 0;
    return (faceColorPalettes[idx] || faceColorPalettes[0]).on;
  };
  const getCellGlow = (cell: string) => {
    if (cell === 'off') return 'none';
    const idx = parseInt(cell.replace('on','') || '0') || 0;
    return `0 0 3px ${(faceColorPalettes[idx] || faceColorPalettes[0]).on}88`;
  };

  return (
    <div style={{ marginTop: 12, background: 'linear-gradient(145deg,rgba(255,255,255,0.85),rgba(252,240,255,0.9))', borderRadius: 20, padding: '14px 16px', border: '1.5px solid rgba(255,255,255,0.8)', boxShadow: '0 4px 16px rgba(180,120,220,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', color: '#9090c0', textTransform: 'uppercase' }}>
          Draw your face
        </span>
        <span style={{ fontSize: '0.55rem', color: '#b0b8cc', fontStyle: 'italic' }}>
          tap = draw · double-tap = erase
        </span>
      </div>

      {/* Color palette selector */}
      {faceColorPalettes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.55rem', color: '#b0b8cc', fontWeight: 600 }}>Color:</span>
          {faceColorPalettes.map((pal, idx) => (
            <button key={idx} onClick={() => setSelectedPaletteIdx(idx)} style={{ width: 20, height: 20, borderRadius: '50%', background: pal.on, border: selectedPaletteIdx === idx ? '2px solid #3040a0' : '2px solid transparent', cursor: 'pointer', padding: 0, boxShadow: selectedPaletteIdx === idx ? `0 0 6px ${pal.glow}` : 'none', transition: 'all 0.2s' }} title={pal.label} />
          ))}
        </div>
      )}

      {/* Pixel grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gap: 1.5, background: '#0d1117', borderRadius: 10, padding: 7, userSelect: 'none', touchAction: 'none', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)' }}>
        {grid.map((cell, i) => (
          <div key={i} onClick={() => handleClick(i)} onDoubleClick={() => handleDoubleClick(i)} onTouchEnd={(e) => handleTouchEnd(e, i)}
            style={{ width: '100%', aspectRatio: '1', borderRadius: 1, background: getCellColor(cell), border: cell === 'off' ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'crosshair', transition: 'background 0.06s', boxShadow: getCellGlow(cell) }}
          />
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={clearGrid} style={{ flex: 1, padding: '6px 0', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(180,160,220,0.1)', border: '1px solid rgba(180,160,220,0.25)', borderRadius: 10, color: '#9090c0', cursor: 'pointer', letterSpacing: '0.06em' }}>Clear</button>
        <button onClick={onReset} style={{ flex: 1, padding: '6px 0', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(100,180,255,0.1)', border: '1px solid rgba(100,180,255,0.25)', borderRadius: 10, color: '#6090c0', cursor: 'pointer', letterSpacing: '0.06em' }}>Reset eyes</button>
        <button onClick={() => onSend([...grid])} style={{ flex: 1, padding: '6px 0', fontSize: '0.65rem', fontWeight: 800, background: `${waveColor}22`, border: `1px solid ${waveColor}66`, borderRadius: 10, color: waveColor, cursor: 'pointer', letterSpacing: '0.06em', transition: 'background 0.2s' }}>Send ✦</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Signal Panel (center hero)
───────────────────────────────────────────── */
function SignalPanel({ knob, onKnobChange, colorThemes }: { knob: number; onKnobChange: (v: number) => void; colorThemes: ColorTheme[] }) {
  const theme = colorThemes[knob % colorThemes.length];
  // 4 positions evenly spaced around the dial: -135°, -45°, 45°, 135°
  const knobAngle = -135 + (knob % colorThemes.length) * (270 / Math.max(1, colorThemes.length - 1));

  const handleClick = () => {
    onKnobChange((knob + 1) % colorThemes.length);
  };

  return (
    <div style={{ flex: 1, background: 'linear-gradient(145deg,rgba(255,255,255,0.85),rgba(252,240,245,0.9))', borderRadius: 28, padding: '20px 24px', boxShadow: '0 8px 32px rgba(220,140,180,0.12), inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 8px rgba(200,150,180,0.08)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(255,255,255,0.8)' }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.wave, boxShadow: `0 0 8px ${theme.wave}`, transition: 'background 0.3s, box-shadow 0.3s' }} />
        <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.18em', color: '#8090b0', textTransform: 'uppercase' }}>ClassCard Signal</span>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.wave, boxShadow: `0 0 8px ${theme.wave}`, transition: 'background 0.3s, box-shadow 0.3s' }} />
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        {/* Waveform screen */}
        <div style={{ flex: 1, height: 120, background: '#0a0e1a', borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.6), 0 2px 8px rgba(100,80,140,0.15)', border: '1px solid rgba(80,60,100,0.3)' }}>
          <Waveform colorIndex={knob % colorThemes.length} />
        </div>

        {/* Knob — click to cycle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div
            onClick={handleClick}
            style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(145deg,#fff,#e8eef8)', boxShadow: '4px 4px 12px rgba(180,190,220,0.5), -3px -3px 8px rgba(255,255,255,0.9), inset 0 1px 3px rgba(255,255,255,0.8)', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', border: `2px solid ${theme.wave}44`, transition: 'border-color 0.3s, box-shadow 0.3s' }}
          >
            {/* Knob ring */}
            <div style={{ width: 68, height: 68, borderRadius: '50%', border: `2px solid ${theme.wave}55`, position: 'absolute', transition: 'border-color 0.3s' }} />
            {/* Indicator dot — snaps to one of 4 positions */}
            <div style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: theme.wave, top: 8, left: '50%', marginLeft: -4, transform: `rotate(${knobAngle}deg)`, transformOrigin: '4px 32px', boxShadow: `0 0 6px ${theme.wave}`, transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), background 0.3s, box-shadow 0.3s' }} />
            {/* Color count indicator */}
            <div style={{ position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '0.5rem', color: '#b0b8d0', whiteSpace: 'nowrap' }}>{colorThemes.length} colors</div>
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: theme.dark, textTransform: 'uppercase', transition: 'color 0.3s' }}>{theme.label}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Stats panel
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   Level Up Unlock Modal
───────────────────────────────────────────── */
type UnlockChoice = 'color' | 'face';

interface LevelUpModalProps {
  level: number;
  unlockedChoices: string[];
  onChoose: (choice: UnlockChoice) => void;
}

function LevelUpModal({ level, unlockedChoices, onChoose }: LevelUpModalProps) {
  const unlockedColorCount = 4 + countUnlockedColors(unlockedChoices);
  const unlockedFaceColorCount = 1 + countUnlockedFaceColors(unlockedChoices);
  const canUnlockMoreColors = unlockedColorCount < EXTRA_COLOR_THEMES.length + 4;
  const canUnlockMoreFace = unlockedFaceColorCount < FACE_COLOR_PALETTES.length;

  const nextColorLabel = () => {
    const next = unlockedColorCount;
    if (next >= 8) return '✨ Shiny Gold & Silver';
    if (next >= 6) return 'Tangerine & Crimson';
    return 'Grape & Ocean';
  };
  const nextFaceLabel = () => {
    const labels = ['Yellow', 'Green', 'Pink'];
    return labels[unlockedFaceColorCount - 1] || 'another color';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'linear-gradient(145deg,#1a1040,#2d1b69)', borderRadius: 28, padding: '32px 28px', maxWidth: 380, width: '90%', boxShadow: '0 24px 80px rgba(100,60,220,0.5)', border: '1.5px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎉</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginBottom: 4 }}>Level {level}!</div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(200,180,255,0.8)', marginBottom: 24, fontWeight: 600 }}>Choose your unlock reward</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Color unlock */}
          <button
            onClick={() => canUnlockMoreColors && onChoose('color')}
            disabled={!canUnlockMoreColors}
            style={{ padding: '16px 20px', borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.15)', background: canUnlockMoreColors ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', cursor: canUnlockMoreColors ? 'pointer' : 'not-allowed', textAlign: 'left', transition: 'all 0.2s', opacity: canUnlockMoreColors ? 1 : 0.4 }}
            onMouseEnter={e => { if (canUnlockMoreColors) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = canUnlockMoreColors ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '1.8rem' }}>🎨</div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', marginBottom: 2 }}>+2 Robot Colors</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(200,180,255,0.7)' }}>{canUnlockMoreColors ? `Unlocks: ${nextColorLabel()}` : 'All colors unlocked!'}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {Array.from({ length: Math.min(unlockedColorCount + 2, EXTRA_COLOR_THEMES.length + 4) }).map((_, i) => {
                    const all = [...BASE_COLOR_THEMES, ...EXTRA_COLOR_THEMES];
                    return <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: all[i % all.length].wave, border: i >= unlockedColorCount ? '1.5px dashed rgba(255,255,255,0.4)' : 'none', opacity: i >= unlockedColorCount ? 0.4 : 1 }} />;
                  })}
                </div>
              </div>
            </div>
          </button>

          {/* Face color unlock */}
          <button
            onClick={() => canUnlockMoreFace && onChoose('face')}
            disabled={!canUnlockMoreFace}
            style={{ padding: '16px 20px', borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.15)', background: canUnlockMoreFace ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', cursor: canUnlockMoreFace ? 'pointer' : 'not-allowed', textAlign: 'left', transition: 'all 0.2s', opacity: canUnlockMoreFace ? 1 : 0.4 }}
            onMouseEnter={e => { if (canUnlockMoreFace) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = canUnlockMoreFace ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '1.8rem' }}>👁️</div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', marginBottom: 2 }}>+1 Face Pixel Color</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(200,180,255,0.7)' }}>{canUnlockMoreFace ? `Unlocks: ${nextFaceLabel()} pixels` : 'All face colors unlocked!'}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {FACE_COLOR_PALETTES.map((pal, i) => (
                    <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: pal.on, border: i >= unlockedFaceColorCount ? '1.5px dashed rgba(255,255,255,0.4)' : 'none', opacity: i >= unlockedFaceColorCount ? 0.4 : 1 }} />
                  ))}
                </div>
              </div>
            </div>
          </button>
        </div>

        {(!canUnlockMoreColors && !canUnlockMoreFace) && (
          <button onClick={() => onChoose('color')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.75rem' }}>
            Close (all unlocked!)
          </button>
        )}
      </div>
    </div>
  );
}

function StatsPanel({ total, medals, scoreboard, weekEnd, onSignOut, studentName, studentId }: {
  total: number;
  medals: { gold: number; silver: number; bronze: number };
  scoreboard: { student_id: string; name: string; wins: number }[];
  weekEnd: string;
  onSignOut: () => void;
  studentName: string;
  studentId: string;
}) {
  const MEDAL_STYLES = [
    { bg: 'linear-gradient(135deg,#ffd700,#ffb700)', shadow: 'rgba(255,200,0,0.4)', label: '🥇', text: '#7a5c00' },
    { bg: 'linear-gradient(135deg,#c0c0c0,#a0a0a0)', shadow: 'rgba(160,160,160,0.4)', label: '🥈', text: '#505050' },
    { bg: 'linear-gradient(135deg,#cd7f32,#a05a20)', shadow: 'rgba(160,90,30,0.4)', label: '🥉', text: '#5a2800' },
  ];

  return (
    <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* User badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.7)', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 12px rgba(200,160,200,0.1)', backdropFilter: 'blur(8px)', overflow: 'hidden' }}>
        {/* Name area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', flex: 1, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#fce4ec,#e8eaf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', boxShadow: '0 2px 8px rgba(200,140,180,0.2)', flexShrink: 0 }}>🤖</div>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', color: '#5060a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studentName.toUpperCase()}</span>
        </div>
        {/* Sign out — square, same height as badge */}
        <button
          onClick={onSignOut}
          title="Sign out"
          style={{ width: 52, alignSelf: 'stretch', flexShrink: 0, background: 'rgba(220,180,220,0.15)', border: 'none', borderLeft: '1.5px solid rgba(200,160,220,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#9090c0', transition: 'background 0.2s, color 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(240,100,120,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#e05070'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,180,220,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#9090c0'; }}
        >
          ⏻
        </button>
      </div>

      {/* Stats card */}
      <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 24, padding: '18px 16px', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 8px 24px rgba(200,160,220,0.1)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Total cards */}
        <div>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', color: '#a0a8c8', textTransform: 'uppercase', marginBottom: 3 }}>TOTAL CARDS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#3040a0', lineHeight: 1 }}>{total}</div>
        </div>

        {/* Arena medals */}
        <div>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', color: '#a0a8c8', textTransform: 'uppercase', marginBottom: 8 }}>ARENA MEDALS</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[medals.gold, medals.silver, medals.bronze].map((count, i) => (
              <div key={i} style={{ flex: 1, borderRadius: 14, padding: '8px 4px', background: count > 0 ? MEDAL_STYLES[i].bg : 'rgba(200,200,220,0.15)', boxShadow: count > 0 ? `0 4px 12px ${MEDAL_STYLES[i].shadow}` : 'none', textAlign: 'center', transition: 'all 0.3s', opacity: count > 0 ? 1 : 0.4 }}>
                <div style={{ fontSize: '1rem' }}>{MEDAL_STYLES[i].label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: count > 0 ? MEDAL_STYLES[i].text : '#a0a8c8', lineHeight: 1.1 }}>{count}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.52rem', color: '#b0b8d0', marginTop: 6, textAlign: 'center', letterSpacing: '0.05em' }}>all-time finishes</div>
        </div>
      </div>

      {/* Battle button */}
      <div
        onClick={() => { window.location.hash = '/arena'; }}
        style={{ cursor: 'pointer' }}
      >
        <div
          style={{ background: 'linear-gradient(135deg,#f06292,#ab47bc,#64b5f6)', borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 6px 20px rgba(180,80,180,0.3)', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(180,80,180,0.5)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(180,80,180,0.3)'; }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase' }}>Battle Arena</span>
          <span style={{ fontSize: '1rem' }}>⚔️</span>
        </div>
      </div>

      {/* Weekly scoreboard */}
      <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 20, padding: '14px 14px', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 16px rgba(200,160,220,0.08)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.13em', color: '#7060b0', textTransform: 'uppercase' }}>🏆 This Week</span>
          <span style={{ fontSize: '0.52rem', color: '#b0b8d0', letterSpacing: '0.04em' }}>ends {weekEnd}</span>
        </div>
        {scoreboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#c0c8e0', fontSize: '0.68rem' }}>No battles yet!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {scoreboard.map((entry, i) => {
              const isMe = entry.student_id === studentId;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              return (
                <div key={entry.student_id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 10, background: isMe ? 'rgba(100,120,220,0.12)' : 'rgba(255,255,255,0.5)', border: isMe ? '1px solid rgba(100,120,220,0.3)' : '1px solid transparent', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: '0.8rem', flexShrink: 0, minWidth: 20 }}>{medal}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: isMe ? 800 : 600, color: isMe ? '#3040a0' : '#6070a0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#6070a0', flexShrink: 0 }}>{entry.wins}W</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(200,200,220,0.3)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.52rem', color: '#c0c8e0', letterSpacing: '0.08em' }}>RESETS MONDAY · 1 BATTLE / OPPONENT</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card item in carousel
───────────────────────────────────────────── */
function CardItem({ card, onClick }: { card: Card; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const stars = { common: 1, silver: 2, 'gold-rare': 3, prismatic: 4 }[card.rarity] ?? 1;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        width: 180,
        borderRadius: 22,
        padding: '0 0 14px',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-8px) scale(1.03)' : 'translateY(0) scale(1)',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: hovered
          ? '0 16px 40px rgba(180,120,220,0.25)'
          : '0 4px 16px rgba(180,120,220,0.12)',
        overflow: 'hidden',
        ...rarityCardStyle(card.rarity),
      }}
    >
      {/* Stars */}
      <div style={{ padding: '10px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: card.rarity === 'common' ? '#9090b0' : card.rarity === 'silver' ? '#7090a0' : card.rarity === 'gold-rare' ? '#c08000' : '#9040c0' }}>
          {RARITY_ICONS[card.rarity]}
        </span>
        <span style={{ fontSize: '0.6rem', color: 'rgba(0,0,0,0.3)' }}>
          {'★'.repeat(stars)}{'☆'.repeat(4 - stars)}
        </span>
      </div>

      {/* Image */}
      <div style={{ width: '100%', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {card.image_url
          ? <img src={card.image_url} alt={card.card_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>🃏</div>
        }
      </div>

      {/* Name */}
      <div style={{ padding: '6px 12px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: '#3040a0', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.card_name}
        </div>
        {card.rarity === 'prismatic' && (
          <div style={{ fontSize: '0.5rem', color: '#9040c0', marginTop: 2 }}>✦ PRISMATIC ✦</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card Carousel
───────────────────────────────────────────── */
function CardCarousel({ cards, onCardClick }: { cards: Card[]; onCardClick: (c: Card) => void }) {
  const [page, setPage] = useState(0);
  const perPage = 6;
  const totalPages = Math.ceil(cards.length / perPage);
  const visible = cards.slice(page * perPage, page * perPage + perPage);

  return (
    <div style={{ background: 'rgba(255,255,255,0.55)', borderRadius: 28, padding: '20px 24px', border: '1.5px solid rgba(255,255,255,0.85)', boxShadow: '0 4px 20px rgba(200,160,220,0.08)', backdropFilter: 'blur(8px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#64b5f6', fontSize: '0.7rem' }}>✦</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: '#5060a0', textTransform: 'uppercase' }}>Your Cards</span>
        </div>
        {totalPages > 1 && (
          <button
            onClick={() => setPage(p => (p + 1) % totalPages)}
            style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(100,120,220,0.1)', border: '1px solid rgba(100,120,220,0.2)', color: '#6070c0', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >▶</button>
        )}
      </div>

      {/* Cards row */}
      {cards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#a0a8c8', fontSize: '0.85rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.3 }}>🃏</div>
          No cards yet — keep up the great work!
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
          {visible.map(card => (
            <CardItem key={card.id} card={card} onClick={() => onCardClick(card)} />
          ))}
        </div>
      )}

      {/* Pagination dots */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              style={{ width: i === page ? 20 : 8, height: 8, borderRadius: 10, background: i === page ? 'linear-gradient(90deg,#f06292,#64b5f6)' : 'rgba(160,170,210,0.35)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }}
            />
          ))}
          <span style={{ color: '#a0a8c8', fontSize: '0.6rem', display: 'flex', alignItems: 'center', marginLeft: 4 }}>▶</span>
        </div>
      )}
    </div>
  );
}


/* ─────────────────────────────────────────────
   Weekly Project banner + modal
───────────────────────────────────────────── */
type WeeklyProjectProps = { project: WeeklyProject; onClose: () => void };

function WeeklyProjectModal({ project, onClose }: WeeklyProjectProps) {
  const card = project.card_data as Card | null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(100,80,140,0.3)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.97),rgba(248,240,252,0.98))', borderRadius: 32, padding: '32px', maxWidth: 740, width: '90vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(160,80,200,0.18)', border: '2px solid rgba(255,255,255,0.9)', position: 'relative' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(180,160,220,0.12)', border: 'none', fontSize: '1rem', cursor: 'pointer', color: '#9090c0' }}>✕</button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '1rem' }}>📋</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em', color: '#9090c0', textTransform: 'uppercase' }}>Weekly Project</span>
            {project.week_label && (
              <span style={{ fontSize: '0.6rem', color: '#b0b8d0', marginLeft: 4 }}>· {project.week_label}</span>
            )}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#3040a0', margin: 0 }}>{project.title}</h2>
        </div>

        {/* Two-column layout: task left, card right */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '55%' }} />
            <col style={{ width: '45%' }} />
          </colgroup>
          <tbody>
            <tr>
              {/* Left: task description */}
              <td style={{ verticalAlign: 'top', paddingRight: 28 }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', color: '#a0a8c8', textTransform: 'uppercase', marginBottom: 10 }}>What you need to do</div>
                <p style={{ fontSize: '0.95rem', color: '#4050a0', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{project.task}</p>

                {/* Earn card hint */}
                <div style={{ marginTop: 24, padding: '14px 18px', background: 'rgba(100,180,100,0.08)', border: '1.5px solid rgba(100,180,100,0.2)', borderRadius: 16 }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: '#4a9a60', textTransform: 'uppercase', marginBottom: 4 }}>✦ Earn a card</div>
                  <p style={{ fontSize: '0.82rem', color: '#5a7060', margin: 0, lineHeight: 1.5 }}>
                    Complete this project and your teacher will award you a card — the better the effort, the rarer the card!
                  </p>
                </div>
              </td>

              {/* Right: card preview */}
              <td style={{ verticalAlign: 'top', textAlign: 'center' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', color: '#a0a8c8', textTransform: 'uppercase', marginBottom: 10 }}>Card you could earn</div>
                {card && card.card_name ? (
                  <div style={{ display: 'inline-block', transform: 'scale(0.8)', transformOrigin: 'top center' }}>
                    {card.card_source === 'built'
                      ? <BuiltCard card={card as Card} size="full" />
                      : <PokeCard card={card as Card} size="full" />
                    }
                  </div>
                ) : (
                  <div style={{ padding: '40px 20px', background: 'rgba(100,120,220,0.05)', border: '2px dashed rgba(100,120,220,0.2)', borderRadius: 20, color: '#a0a8c8' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: 0.4 }}>🃏</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>Card coming soon</div>
                    <div style={{ fontSize: '0.65rem', marginTop: 4, opacity: 0.7 }}>Your teacher is preparing it</div>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeeklyProjectBanner({ project, onClick }: { project: WeeklyProject; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? 'linear-gradient(135deg,rgba(255,248,220,0.95),rgba(255,230,160,0.95))'
          : 'linear-gradient(135deg,rgba(255,252,235,0.9),rgba(255,240,180,0.88))',
        borderRadius: 22,
        padding: '18px 24px',
        border: '1.5px solid rgba(220,180,60,0.45)',
        boxShadow: hovered
          ? '0 8px 28px rgba(200,160,40,0.2)'
          : '0 4px 16px rgba(200,160,40,0.1)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#ffd54f,#ffb300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 4px 12px rgba(200,150,0,0.3)', flexShrink: 0 }}>
          📋
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', color: '#b08000', textTransform: 'uppercase', marginBottom: 2 }}>
            Weekly Project{project.week_label ? ` · ${project.week_label}` : ''}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#5a3a00' }}>{project.title}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9a7000' }}>View task</span>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(200,150,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#b08000' }}>▶</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card detail modal
───────────────────────────────────────────── */
function CardDetail({ card, onClose }: { card: Card; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(100,80,140,0.3)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.97),rgba(248,240,252,0.98))', borderRadius: 32, padding: '32px', maxWidth: 720, width: '90vw', boxShadow: '0 24px 64px rgba(160,80,200,0.18)', border: '2px solid rgba(255,255,255,0.9)', position: 'relative' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(180,160,220,0.12)', border: 'none', fontSize: '1rem', cursor: 'pointer', color: '#9090c0' }}>✕</button>

        {/* Two-column table layout — card left, info right */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 200 }} />
            <col />
          </colgroup>
          <tbody>
            <tr>
              {/* Left column: card (scaled down) */}
              <td style={{ verticalAlign: 'top', paddingRight: 28 }}>
                <div style={{ transform: 'scale(0.78)', transformOrigin: 'top left', width: 'fit-content' }}>
                  {card.card_source === 'built' ? <BuiltCard card={card} /> : <PokeCard card={card} />}
                </div>
              </td>

              {/* Right column: text info */}
              <td style={{ verticalAlign: 'top' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3040a0', marginBottom: 4, marginTop: 0 }}>{card.card_name}</h2>
                <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: 'rgba(100,120,220,0.08)', border: '1px solid rgba(100,120,220,0.15)', fontSize: '0.65rem', fontWeight: 700, color: '#6070c0', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {RARITY_ICONS[card.rarity]} {card.rarity}
                </div>
                <p style={{ fontSize: '0.88rem', color: '#7080b0', fontStyle: 'italic', marginBottom: 20, lineHeight: 1.5 }}>"{card.description}"</p>
                {[
                  ['HP', card.hp], ['Type', card.type],
                  [card.stat1_name, card.stat1_val], [card.stat2_name, card.stat2_val], [card.stat3_name, card.stat3_val],
                  [card.move1_name, `${card.move1_dmg} dmg`], [card.move2_name, `${card.move2_dmg} dmg`],
                  ['Awarded', new Date(card.created_at).toLocaleDateString()],
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(100,120,220,0.08)' }}>
                    <span style={{ fontSize: '0.72rem', color: '#9090c0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3040a0' }}>{v}</span>
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main dashboard
───────────────────────────────────────────── */
function StudentPage({ session, onSignOut }: { session: NonNullable<Session>; onSignOut: () => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [studentName, setStudentName] = useState('Student');
  const [studentId, setStudentId] = useState('');
  const [weeklyProject, setWeeklyProject] = useState<WeeklyProject | null>(null);
  const [showProject, setShowProject] = useState(false);
  const [medals, setMedals] = useState({ gold: 0, silver: 0, bronze: 0 });
  const [scoreboard, setScoreboard] = useState<{ student_id: string; name: string; wins: number }[]>([]);
  const [savedBotKey, setSavedBotKey] = useState(0);
  const faceKey = `classcard_face_${session.user.id}`;
  const [facePixels, setFacePixelsRaw] = useState<string[] | null>(() => {
    try { const v = localStorage.getItem(faceKey); return v ? JSON.parse(v) : null; }
    catch { return null; }
  });
  const setFacePixels = (px: string[] | null) => {
    setFacePixelsRaw(px);
    try {
      if (px) localStorage.setItem(faceKey, JSON.stringify(px));
      else localStorage.removeItem(faceKey);
    } catch { /* ignore */ }
  };

  // Unlock system state
  const [unlockedChoices, setUnlockedChoices] = useState<string[]>([]);
  const [pendingUnlocks, setPendingUnlocks] = useState(0);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const [unlocksLoaded, setUnlocksLoaded] = useState(false);

  // Color index — stored in Supabase via student metadata
  const storageKey = `classcard_robot_knob_${session.user.id}`;
  const [knob, setKnobRaw] = useState<number>(() => {
    try { const v = localStorage.getItem(storageKey); return v !== null ? Math.min(3, Math.max(0, parseInt(v, 10) || 0)) : 0; }
    catch { return 0; }
  });

  const setKnob = (v: number) => {
    setKnobRaw(v);
    try { localStorage.setItem(storageKey, String(v)); } catch { /* ignore */ }
  };

  // Derived unlock counts
  const unlockedColorCount = 4 + countUnlockedColors(unlockedChoices);
  const unlockedFaceColorCount = 1 + countUnlockedFaceColors(unlockedChoices);
  const colorThemes = buildColorThemes(unlockedColorCount);
  const faceColorPalettes = FACE_COLOR_PALETTES.slice(0, unlockedFaceColorCount);
  const robotColor = knobToRobotColor(knob, colorThemes);

  // Load unlocks from Supabase
  useEffect(() => {
    const loadUnlocks = async () => {
      if (!studentId) return;
      const { data } = await sb.from('student_unlocks').select('choices').eq('student_id', studentId).maybeSingle();
      const choices: string[] = data?.choices || [];
      setUnlockedChoices(choices);
      setUnlocksLoaded(true);
    };
    if (studentId) loadUnlocks();
  }, [studentId]);

  // Save a new unlock choice to Supabase
  const saveUnlockChoice = async (choice: string) => {
    if (!studentId) return;
    const newChoices = [...unlockedChoices, choice];
    setUnlockedChoices(newChoices);
    await sb.from('student_unlocks').upsert({ student_id: studentId, choices: newChoices }, { onConflict: 'student_id' });
  };

  // Detect level-ups and queue pending unlocks.
  // On first load, compare current level vs choices already made — this
  // catches students who were already at level 2+ before the unlock system existed.
  useEffect(() => {
    if (!unlocksLoaded || cards.length === 0) return;
    const currentLevel = Math.max(1, Math.floor(cards.length / 5) + 1);

    if (prevLevel === null) {
      // First time running after unlocks loaded — check if they have unclaimed unlocks
      // Each level above 1 earns one unlock, so they should have (currentLevel - 1) choices.
      // Any deficit means unclaimed unlocks.
      const earnedUnlocks = currentLevel - 1;
      const claimedUnlocks = unlockedChoices.length;
      const owed = Math.max(0, earnedUnlocks - claimedUnlocks);
      if (owed > 0) setPendingUnlocks(owed);
      setPrevLevel(currentLevel);
      return;
    }

    if (currentLevel > prevLevel) {
      setPendingUnlocks(p => p + (currentLevel - prevLevel));
      setPrevLevel(currentLevel);
    }
  }, [cards.length, unlocksLoaded]);

  const loadCards = useCallback(async () => {
    try {
      const profile = session.profile;
      setStudentName(profile.name || 'Student');
      let sid = profile.student_id;
      if (!sid) {
        const { data } = await (await import('../lib/supabase')).sb
          .from('students').select('id').eq('auth_user_id', session.user.id).maybeSingle();
        if (data) sid = data.id;
      }
      if (sid) {
        setStudentId(sid);
        setCards(await Dashboard.getStudentCards(sid));
        // Fetch teacher's weekly project
        const { data: studentRow } = await sb.from('students').select('teacher_id').eq('id', sid).maybeSingle();
        const teacherId = studentRow?.teacher_id;
        if (teacherId) {
          const { data: proj } = await sb
            .from('weekly_projects')
            .select('*')
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (proj) setWeeklyProject(proj as WeeklyProject);
          // Medals + scoreboard (same teacher cohort)
          const [m, sb2] = await Promise.all([
            getMedalCounts(sid, teacherId),
            getWeeklyScoreboard(teacherId),
          ]);
          setMedals(m);
          setScoreboard(sb2);
        }
      }
    } catch { /* silent */ }
  }, [session]);

  useEffect(() => { loadCards(); }, [loadCards]);

  // Robot level is now based on card count
  const level = Math.max(1, Math.floor(cards.length / 5) + 1);
  const xp = (cards.length % 5) * 100;

  const firstName = studentName.split(' ')[0];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
        .sd-page * { font-family: 'Nunito', 'Segoe UI', sans-serif !important; }
        .sd-page ::-webkit-scrollbar { height: 4px; }
        .sd-page ::-webkit-scrollbar-track { background: rgba(200,180,220,0.1); border-radius: 10px; }
        .sd-page ::-webkit-scrollbar-thumb { background: rgba(160,140,200,0.3); border-radius: 10px; }
      `}</style>

      <div
        className="sd-page"
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #fce4ec 0%, #f3e5f5 30%, #e8eaf6 60%, #e1f5fe 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        {/* Level up unlock modal */}
      {pendingUnlocks > 0 && (
        <LevelUpModal
          level={level}
          unlockedChoices={unlockedChoices}
          onChoose={async (choice) => {
            await saveUnlockChoice(choice);
            setPendingUnlocks(p => Math.max(0, p - 1));
          }}
        />
      )}

      {/* Outer container */}
        <div style={{
          width: '100%',
          maxWidth: 1160,
          background: 'rgba(255,255,255,0.45)',
          borderRadius: 40,
          padding: '28px 32px',
          boxShadow: '0 20px 80px rgba(180,120,220,0.12), 0 4px 24px rgba(200,160,240,0.08)',
          border: '2px solid rgba(255,255,255,0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>

          {/* ── TOP ROW ── */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

            {/* Welcome + Robot */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexShrink: 0 }}>
              <div>
                <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: '#2030a0', margin: 0, lineHeight: 1.1 }}>
                  Hey {firstName}!
                </h1>
                <p style={{ fontSize: '0.85rem', color: '#8090c0', margin: '6px 0 0', fontWeight: 600 }}>
                  You've collected {cards.length} card{cards.length !== 1 ? 's' : ''}
                </p>
                <div style={{ marginTop: 16 }}>
                  {localStorage.getItem('savedBot')
                    ? <SavedBotAvatar key={savedBotKey} facePixels={facePixels} faceColorPalettes={faceColorPalettes} />
                    : <RobotAvatar level={level} xp={xp} xpMax={500} color={robotColor} facePixels={facePixels} faceColorPalettes={faceColorPalettes} />
                  }
                </div>
                {/* Reset to default bot — only shown when a saved bot exists */}
                {localStorage.getItem('savedBot') && (
                  <button
                    onClick={() => { localStorage.removeItem('savedBot'); setSavedBotKey(k => k + 1); }}
                    style={{ width: '100%', marginTop: 8, padding: '7px 10px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em' }}
                  >
                    ↺ Reset to Default Bot
                  </button>
                )}
                {/* Build a Bot button — under robot */}
                <div onClick={() => { window.location.hash = '/buildabot'; }} style={{ cursor: 'pointer', marginTop: 10 }}>
                  <div
                    style={{ background: 'linear-gradient(135deg,#43e97b,#38f9d7,#4facfe)', borderRadius: 14, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 6px 20px rgba(67,233,123,0.3)', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(67,233,123,0.5)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(67,233,123,0.3)'; }}
                  >
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase' }}>Build a Bot</span>
                    <span style={{ fontSize: '0.95rem' }}>🤖</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Signal panel + Pixel editor stacked */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <SignalPanel knob={knob} onKnobChange={setKnob} colorThemes={colorThemes} />
              <PixelEditor
                faceColorPalettes={faceColorPalettes}
                onSend={setFacePixels}
                onReset={() => setFacePixels(null)}
              />
            </div>

            {/* Stats panel */}
            <StatsPanel
              total={cards.length}
              medals={medals}
              scoreboard={scoreboard}
              weekEnd={getWeekEnd()}
              onSignOut={onSignOut}
              studentName={studentName}
              studentId={studentId}
            />
          </div>

          {/* ── WEEKLY PROJECT BANNER ── */}
          {weeklyProject && (
            <WeeklyProjectBanner project={weeklyProject} onClick={() => setShowProject(true)} />
          )}

          {/* ── CARD CAROUSEL ── */}
          <CardCarousel cards={cards} onCardClick={setDetailCard} />
        </div>
      </div>

      {detailCard && <CardDetail card={detailCard} onClose={() => setDetailCard(null)} />}
      {showProject && weeklyProject && (
        <WeeklyProjectModal project={weeklyProject} onClose={() => setShowProject(false)} />
      )}
    </>
  );
}

export default StudentPage;
