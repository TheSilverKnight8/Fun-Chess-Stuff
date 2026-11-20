import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cx } from '../components/ui';
import { sfx } from '../lib/audio/sfx';
import { modeInfo, type ModeId } from '../modes';
import { GuideBoard } from './GuideBoard';
import { GUIDES, type GuideSection } from './guides';

// The manual as a flipbook (Caleb's request): it drops down from the top of
// the screen, opens on a cover, and turns its pages with a 3D page flip. On wide
// screens each spread shows a section's words on the left page and its animated
// scene on the right; on phones each page holds both. Arrows, swipes and the
// arrow keys turn pages; Escape or the close button lifts the book away.

const FLIP_MS = 650;
const DROP_MS = 520;

type Page = { kind: 'cover' } | { kind: 'section'; s: GuideSection; n: number } | { kind: 'end' } | { kind: 'missing' };

export function Flipbook({ mode, onClose, note }: { mode: ModeId; onClose: () => void; note?: string }) {
  const sections = GUIDES[mode];
  const pages: Page[] = sections ? [{ kind: 'cover' }, ...sections.map((s, n) => ({ kind: 'section' as const, s, n })), { kind: 'end' }] : [{ kind: 'cover' }, { kind: 'missing' }];
  const [page, setPage] = useState(0);
  const [flip, setFlip] = useState<{ dir: 1 | -1; to: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const wide = useWide();
  const touch = useRef<number | null>(null);

  const close = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    sfx.bookClose();
    window.setTimeout(onClose, DROP_MS - 120);
  }, [leaving, onClose]);

  const turn = useCallback(
    (dir: 1 | -1) => {
      if (flip) return;
      const to = page + dir;
      if (to < 0 || to >= pages.length) return;
      sfx.pageTurn();
      setFlip({ dir, to });
      // The content underneath changes halfway through, while the leaf hides it.
      window.setTimeout(() => setPage(to), FLIP_MS / 2);
      window.setTimeout(() => setFlip(null), FLIP_MS);
    },
    [flip, page, pages.length],
  );

  useEffect(() => {
    sfx.bookOpen();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') turn(1);
      else if (e.key === 'ArrowLeft') turn(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, turn]);

  const info = modeInfo(mode);
  const p = pages[page];

  return (
    <div className={cx('fixed inset-0 z-50 flex justify-center bg-navy/35', leaving ? 'animate-[fade_0.4s_ease_reverse_both]' : 'animate-fade')} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        role="dialog"
        aria-label={`${info.name} manual`}
        className={cx('relative mt-[max(0.75rem,env(safe-area-inset-top))] flex h-[min(92dvh,760px)] w-[min(96vw,1100px)] flex-col', leaving ? 'animate-book-lift' : 'animate-book-drop')}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1);
        }}
      >
        {/* The book: navy covers, cream pages, a shadowed spine. */}
        <div className="relative flex-1 rounded-xl border-[3px] border-navy bg-navy p-[10px] shadow-pop [perspective:2200px]">
          <div className="relative flex h-full overflow-hidden rounded-md bg-[#fbf3e3]">
            {p.kind === 'cover' ? (
              <Cover mode={mode} wide={wide} note={note} />
            ) : wide ? (
              <>
                <PaperPage side="left">{left(p, mode)}</PaperPage>
                <PaperPage side="right">{right(p, mode)}</PaperPage>
              </>
            ) : (
              <PaperPage side="single">
                {left(p, mode)}
                <div className="mt-4">{right(p, mode)}</div>
              </PaperPage>
            )}
            {wide && p.kind !== 'cover' && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgb(0_38_87/0.16)_45%,rgb(0_38_87/0.22)_50%,rgb(0_38_87/0.16)_55%,transparent)]" />}
            {/* The turning leaf. */}
            {flip && <Leaf dir={flip.dir} wide={wide && pages[Math.min(page, flip.to)].kind !== 'cover'} />}
          </div>
        </div>

        {/* Controls under the book. */}
        <div className="mt-2 flex items-center gap-2">
          <button type="button" aria-label="Previous page" disabled={page === 0 || !!flip} onClick={() => turn(-1)} className="press flex size-11 items-center justify-center rounded-xl border-2 border-navy bg-surface [--lift:3px] disabled:opacity-40">
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-surface/90 px-3 py-2">
            {pages.map((_, i) => (
              <span key={i} className={cx('h-2 shrink-0 rounded-full transition-all', i === page ? 'w-6 bg-accent' : 'w-2 bg-navy/30')} />
            ))}
          </div>
          <button type="button" aria-label="Next page" disabled={page === pages.length - 1 || !!flip} onClick={() => turn(1)} className="press flex size-11 items-center justify-center rounded-xl border-2 border-navy bg-accent text-on-accent [--lift:3px] disabled:opacity-40">
            <ChevronRight className="size-5" />
          </button>
          <button type="button" aria-label="Close the manual" onClick={close} className="press flex size-11 items-center justify-center rounded-xl border-2 border-navy bg-surface [--lift:3px]">
            <X className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function useWide() {
  const [wide, setWide] = useState(() => window.innerWidth >= 760);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 760);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return wide;
}

function left(p: Page, mode: ModeId) {
  if (p.kind === 'missing') return <p className="text-muted">{modeInfo(mode).name}’s manual arrives with the mode itself.</p>;
  if (p.kind === 'end')
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="stripes stripes-tl w-40" aria-hidden />
        <p className="mt-4 font-display text-3xl uppercase">The end</p>
        <p className="mt-2 text-sm text-muted">Good luck.</p>
      </div>
    );
  if (p.kind !== 'section') return null;
  return (
    <div>
      <p className="label-caps text-accent">Page {p.n + 1}</p>
      <h2 className="mt-1 text-3xl">{p.s.title}</h2>
      {p.s.text.map((t, i) => (
        <p key={i} className="mt-3 text-[0.9375rem] leading-relaxed text-ink">
          {t}
        </p>
      ))}
    </div>
  );
}

function right(p: Page, mode: ModeId) {
  if (p.kind !== 'section') return null;
  // Keyed by page, so a scene starts over each time its page is opened.
  if (p.s.scene) return <GuideBoard key={`${mode}-${p.n}`} scene={p.s.scene} className="mx-auto max-w-[360px]" />;
  return (
    <div className="flex h-full items-center justify-center opacity-25" aria-hidden>
      <div className="stripes stripes-br w-40" />
    </div>
  );
}

function PaperPage({ side, children }: { side: 'left' | 'right' | 'single'; children: React.ReactNode }) {
  return (
    <div
      className={cx(
        'relative h-full overflow-y-auto px-6 py-6 sm:px-8',
        side === 'single' ? 'w-full' : 'w-1/2',
        side === 'left' && 'bg-[linear-gradient(90deg,#fbf3e3_85%,#efe2c8)]',
        side === 'right' && 'flex flex-col justify-center bg-[linear-gradient(270deg,#fbf3e3_85%,#efe2c8)]',
      )}
    >
      {children}
    </div>
  );
}

function Cover({ mode, wide, note }: { mode: ModeId; wide: boolean; note?: string }) {
  const m = modeInfo(mode);
  return (
    <div className={cx('relative flex h-full w-full flex-col justify-center bg-navy px-8 text-on-accent', wide && 'px-16')}>
      <div className="stripes stripes-tl absolute left-0 right-0 top-8 [--stripe-a:var(--brand-cream)]" aria-hidden />
      <p className="label-caps text-accent">Manual</p>
      <h2 className="mt-2 text-5xl leading-none">{m.name}</h2>
      {m.author && <p className="mt-3 text-sm opacity-80">{m.author}</p>}
      <p className="mt-6 max-w-sm opacity-90">{m.blurb}</p>
      {note && <p className="mt-6 text-xs opacity-70">{note}</p>}
      <p className="absolute bottom-6 left-8 text-xs opacity-60">Turn the page →</p>
    </div>
  );
}

/** A page turning: a paper leaf swinging over the spine (or across the whole page on phones). */
function Leaf({ dir, wide }: { dir: 1 | -1; wide: boolean }) {
  return (
    <div
      className={cx('pointer-events-none absolute inset-y-0 [transform-style:preserve-3d]', wide ? 'w-1/2' : 'w-full', dir === 1 ? (wide ? 'left-1/2 origin-left' : 'left-0 origin-left') : wide ? 'left-0 origin-right' : 'left-0 origin-right')}
      style={{ animation: `${dir === 1 ? 'leaf-next' : 'leaf-prev'} ${FLIP_MS}ms cubic-bezier(0.45, 0.05, 0.35, 1) both` }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#efe2c8,#fbf3e3_30%,#fbf3e3_70%,#e9d9bb)] shadow-[0_0_30px_rgb(0_38_87/0.35)] [backface-visibility:hidden]">
        <PageLines />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(270deg,#efe2c8,#fbf3e3_30%,#fbf3e3_70%,#e9d9bb)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <PageLines />
      </div>
    </div>
  );
}

function PageLines() {
  return (
    <div className="absolute inset-x-[12%] top-[14%] grid gap-3 opacity-30" aria-hidden>
      {[90, 75, 85, 60, 80, 70, 88, 55].map((w, i) => (
        <span key={i} className="block h-1.5 rounded-full bg-navy" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
