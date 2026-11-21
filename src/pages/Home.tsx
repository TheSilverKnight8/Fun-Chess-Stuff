import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bot, BookOpen, DoorOpen, LogIn, Settings as SettingsIcon } from 'lucide-react';
import { useMusic } from '../lib/audio/useMusic';
import { PageLayout } from '../components/Layout';
import { Button, ButtonLink, Card } from '../components/ui';
import { APP_NAME } from '../config';
import { createRoom, joinRoom } from '../game/session';
import { CODE_LENGTH, normalizeCode } from '../net/room';

export function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  useMusic('menu');

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const c = normalizeCode(code);
    if (!c) {
      setProblem(`A room code is ${CODE_LENGTH} letters and numbers.`);
      return;
    }
    void joinRoom(c);
    navigate('/room');
  };

  return (
    <PageLayout home>
      <div className="animate-rise">
        <p className="label-caps text-accent">Online chess for two</p>
        <h1 className="mt-2 text-5xl sm:text-6xl lg:text-7xl">{APP_NAME}</h1>
        <p className="mt-3 max-w-xl text-muted">Standard Chess and variants that only work on a screen. Make a room, share its code, and play.</p>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Card className="animate-rise p-5" style={{ animationDelay: '60ms' }}>
          <p className="label-caps text-muted">Play a friend</p>
          <Button
            variant="primary"
            size="xl"
            press
            className="mt-4 w-full"
            onClick={() => {
              void createRoom();
              navigate('/room');
            }}
          >
            <DoorOpen className="size-6" />
            Create a room
          </Button>
          <p className="mt-2 text-sm text-muted">You pick the mode and the time control in the room.</p>
          <form onSubmit={join} className="mt-5">
            <label htmlFor="room-code" className="text-sm text-muted">
              Or join a room with its code
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="room-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().slice(0, CODE_LENGTH + 2));
                  setProblem(null);
                }}
                placeholder="ABCDE"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                className="h-14 w-0 min-w-0 flex-1 rounded-xl border-2 border-navy bg-surface px-4 text-center font-mono text-2xl uppercase tracking-[0.35em] text-ink outline-none placeholder:text-muted/40 focus:ring-3 focus:ring-navy/15"
              />
              <Button type="submit" variant="navy" size="lg" press className="h-14">
                <LogIn className="size-5" />
                Join
              </Button>
            </div>
            {problem && <p className="mt-2 text-sm text-warn">{problem}</p>}
          </form>
        </Card>
        <div className="grid content-start gap-5">
          <ButtonLink to="/cpu" size="lg" variant="navy" press className="w-full animate-rise" style={{ animationDelay: '80ms' }}>
            <Bot className="size-5" />
            Play the CPU
          </ButtonLink>
          <ButtonLink to="/guide" size="lg" press className="w-full animate-rise border-2 border-navy" style={{ animationDelay: '100ms' }}>
            <BookOpen className="size-5" />
            Manuals
          </ButtonLink>
          <ButtonLink to="/settings" size="lg" press className="w-full animate-rise border-2 border-navy" style={{ animationDelay: '120ms' }}>
            <SettingsIcon className="size-5" />
            Settings
          </ButtonLink>
        </div>
      </div>
    </PageLayout>
  );
}
