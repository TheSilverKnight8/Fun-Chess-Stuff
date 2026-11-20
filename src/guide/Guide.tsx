import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BookOpen, ChevronRight, X } from 'lucide-react';
import { PageLayout, PageTitle } from '../components/Layout';
import { Card, Chip, cx } from '../components/ui';
import { useMusic } from '../lib/audio/useMusic';
import { MODES, modeInfo, type ModeId } from '../modes';
import { GuideBoard } from './GuideBoard';
import { GUIDES } from './guides';

// The guidebook: a manual per mode with animated scenes. Reached from Home
// (Manuals) by anyone, and from the game screen at any time (the book button),
// which opens it over the game without stopping it.

/** The sections of one mode's manual. Scenes play only while on screen. */
export function GuideContent({ mode }: { mode: ModeId }) {
  const sections = GUIDES[mode];
  if (!sections) return <p className="text-muted">This mode’s manual arrives with the mode itself.</p>;
  return (
    <div className="grid gap-5">
      {sections.map((s, i) => (
        <Card key={i} className="grid gap-4 p-5 md:grid-cols-[1fr_minmax(0,320px)] md:items-start">
          <div>
            <h2 className="text-2xl">{s.title}</h2>
            {s.text.map((t, j) => (
              <p key={j} className="mt-2 text-[0.9375rem] text-ink">
                {t}
              </p>
            ))}
          </div>
          {s.scene && <LazyScene index={i} mode={mode} />}
        </Card>
      ))}
    </div>
  );
}

/** Starts a scene only when it scrolls into view, so a long manual is not running thirty animations. */
function LazyScene({ mode, index }: { mode: ModeId; index: number }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  const scene = GUIDES[mode]![index].scene!;
  return (
    <div ref={setEl} className="min-h-24">
      {seen ? <GuideBoard scene={scene} /> : <div className="w-full rounded-md border-[3px] border-navy bg-raised" style={{ aspectRatio: `8 / ${scene.ranks ? scene.ranks[1] - scene.ranks[0] + 1 : 8}` }} />}
    </div>
  );
}

/** Manuals: the list of modes (Home → Manuals). */
export function ManualsPage() {
  useMusic('menu');
  return (
    <PageLayout back={{ to: '/', label: 'Home' }}>
      <PageTitle eyebrow="Manuals" title="How to play">
        The rules of every mode, with animated examples. You can also open the manual during a game with the book button.
      </PageTitle>
      <div className="mt-8 grid gap-3">
        {MODES.map((m) => (
          <Link key={m.id} to={`/guide/${m.id}`} className="press flex items-center gap-3 rounded-2xl border-2 border-navy bg-surface px-5 py-4 [--lift:4px]">
            <BookOpen className="size-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl uppercase leading-tight">{m.name}</span>
              {m.author && <span className="block text-xs text-muted">{m.author}</span>}
              <span className="mt-1 block text-sm text-muted">{m.blurb}</span>
            </span>
            {!GUIDES[m.id] && <Chip className="shrink-0">Stage {m.stage}</Chip>}
            <ChevronRight className="size-5 shrink-0" />
          </Link>
        ))}
      </div>
    </PageLayout>
  );
}

/** One mode's manual as a page. */
export function GuidePage() {
  useMusic('menu');
  const { mode } = useParams();
  const m = MODES.find((x) => x.id === mode);
  if (!m) return <ManualsPage />;
  return (
    <PageLayout back={{ to: '/guide', label: 'Manuals' }}>
      <PageTitle eyebrow={m.author ? `Manual · ${m.author}` : 'Manual'} title={m.name} />
      <div className="mt-8">
        <GuideContent mode={m.id} />
      </div>
    </PageLayout>
  );
}

/** The manual over the game screen. The game keeps running behind it. */
export function GuideSheet({ mode, onClose }: { mode: ModeId; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex animate-fade justify-end bg-navy/30" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={`${modeInfo(mode).name} manual`} className={cx('flex h-full w-full max-w-3xl animate-rise flex-col border-l-2 border-navy bg-bg shadow-pop')}>
        <div className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <BookOpen className="size-5 text-accent" />
          <p className="flex-1 font-display text-xl uppercase leading-tight">{modeInfo(mode).name} · Manual</p>
          <button type="button" aria-label="Close the manual" className="rounded-lg p-2 hover:bg-raised" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <p className="border-b border-line px-5 py-2 text-xs text-muted">The game keeps going while this is open; your clock runs on your turn.</p>
        <div className="flex-1 overflow-y-auto px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
          <GuideContent mode={mode} />
        </div>
      </div>
    </div>
  );
}
