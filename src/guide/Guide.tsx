import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BookOpen, ChevronRight } from 'lucide-react';
import { PageLayout, PageTitle } from '../components/Layout';
import { Chip } from '../components/ui';
import { sfx } from '../lib/audio/sfx';
import { useMusic } from '../lib/audio/useMusic';
import { MODES, type ModeId } from '../modes';
import { Flipbook } from './Flipbook';
import { GUIDES } from './guides';

// The guidebook. Reached from Home (Manuals) by anyone, and from the game screen
// at any time (the book button). Either way the manual is a flipbook that drops
// down over the screen (Flipbook.tsx).

/** Manuals: the list of modes (Home → Manuals). /guide/<mode> opens that mode's book over the list. */
export function ManualsPage() {
  useMusic('menu');
  const { mode } = useParams();
  const navigate = useNavigate();
  const open = MODES.find((m) => m.id === mode)?.id ?? null;
  return (
    <PageLayout back={{ to: '/', label: 'Home' }}>
      <PageTitle eyebrow="Manuals" title="How to play">
        The rules of every mode, as flipbooks with animated examples. You can also open the manual during a game with the book button.
      </PageTitle>
      <div className="mt-8 grid gap-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => navigate(`/guide/${m.id}`)}
            className="press flex items-center gap-3 rounded-2xl border-2 border-navy bg-surface px-5 py-4 text-left [--lift:4px]"
          >
            <BookOpen className="size-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl uppercase leading-tight">{m.name}</span>
              {m.author && <span className="block text-xs text-muted">{m.author}</span>}
              <span className="mt-1 block text-sm text-muted">{m.blurb}</span>
            </span>
            {!GUIDES[m.id] && <Chip className="shrink-0">Stage {m.stage}</Chip>}
            <ChevronRight className="size-5 shrink-0" />
          </button>
        ))}
      </div>
      {open && <Flipbook key={open} mode={open} onClose={() => navigate('/guide')} />}
    </PageLayout>
  );
}

/** The game screen's book button and the flipbook it opens. */
export function useGameManual(mode: ModeId) {
  const [open, setOpen] = useState(false);
  return {
    openManual: () => {
      sfx.click();
      setOpen(true);
    },
    manual: open ? <Flipbook mode={mode} onClose={() => setOpen(false)} note="The game keeps going while the book is open; your clock runs on your turn." /> : null,
  };
}
