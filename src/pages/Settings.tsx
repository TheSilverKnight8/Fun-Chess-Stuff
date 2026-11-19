import type { ReactNode } from 'react';
import { Footprints, Moon, Music, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import { useMusic } from '../lib/audio/useMusic';
import { PageLayout, PageTitle } from '../components/Layout';
import { Button, Card, Segmented } from '../components/ui';
import { sfx } from '../lib/audio/sfx';
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '../lib/settings';

/** Settings (spec section 4). Nothing is saved, so they go back to the defaults when the app closes. */
export function SettingsPage() {
  const s = useSettings();
  useMusic('menu');
  return (
    <PageLayout back={{ to: '/', label: 'Home' }}>
      <PageTitle eyebrow="Settings" title="Settings">
        Nothing is saved, so settings go back to the defaults when the app is closed.
      </PageTitle>
      <Card className="mt-8 max-w-2xl divide-y divide-line">
        <Slider icon={<Moon className="size-5" />} label="Brightness" value={s.brightness} min={0.5} onChange={(v) => updateSettings({ brightness: v })} />
        <Toggle
          icon={<Sparkles className="size-5" />}
          label="Legal moves"
          value={s.legalMoves}
          onChange={(v) => updateSettings({ legalMoves: v })}
          help="Dots show where the piece you picked up can go."
        />
        <Toggle
          icon={<Footprints className="size-5" />}
          label="Last move"
          value={s.lastMove}
          onChange={(v) => updateSettings({ lastMove: v })}
          help="Marks the two squares of the last move."
        />
        <Slider icon={<Music className="size-5" />} label="Music volume" value={s.musicVolume} onChange={(v) => updateSettings({ musicVolume: v })} />
        <Slider icon={<Volume2 className="size-5" />} label="Effects volume" value={s.effectsVolume} onChange={(v) => updateSettings({ effectsVolume: v })} onRelease={() => sfx.capture(3)} />
      </Card>
      <Button className="mt-5" press onClick={() => updateSettings({ ...DEFAULT_SETTINGS })}>
        <RotateCcw className="size-4" />
        Back to defaults
      </Button>
    </PageLayout>
  );
}

function Slider({
  icon,
  label,
  value,
  min = 0,
  onChange,
  onRelease,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
  /** Effects volume: plays a sample when the slider is let go. */
  onRelease?: () => void;
}) {
  const pct = Math.round(value * 100);
  const fill = ((value - min) / (1 - min)) * 100;
  return (
    <label className="flex items-center gap-4 px-5 py-4">
      <span className="text-muted">{icon}</span>
      <span className="w-36 shrink-0 font-display text-lg uppercase tracking-wide">{label}</span>
      <input
        type="range"
        className="slider min-w-0 flex-1"
        min={min}
        max={1}
        step={0.05}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        aria-label={label}
      />
      <span className="w-12 shrink-0 text-right font-mono text-sm text-muted">{pct}%</span>
    </label>
  );
}

function Toggle({ icon, label, value, onChange, help }: { icon: ReactNode; label: string; value: boolean; onChange: (v: boolean) => void; help: string }) {
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-muted">{icon}</span>
        <span className="w-36 shrink-0 font-display text-lg uppercase tracking-wide">{label}</span>
        <Segmented
          label={label}
          value={value ? 'on' : 'off'}
          onChange={(v) => onChange(v === 'on')}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
        />
      </div>
      <p className="mt-2 text-sm text-muted">{help}</p>
    </div>
  );
}
