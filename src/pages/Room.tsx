import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, Check, Dices, Flag, Zap, Handshake, Loader2, LogOut, Play, RefreshCw, Swords, UserRound, WifiOff } from 'lucide-react';
import { Board } from '../board/Board';
import { useGameManual } from '../guide/Guide';
import { EffectsLayer } from '../effects/EffectsLayer';
import { useClockTicks, useGameFx } from '../effects/useGameFx';
import { setTension } from '../lib/audio/music';
import { sfx } from '../lib/audio/sfx';
import { useMusic } from '../lib/audio/useMusic';
import { PieceArt } from '../board/PieceArt';
import { inCheck } from '../chess/standard';
import { COLOR_NAME, other, type Color } from '../chess/types';
import { PageLayout, PageTitle, PlayLayout } from '../components/Layout';
import { RoomCodeCard, useLeaveOnUnmount } from '../components/RoomBits';
import { confirmDialog, notify } from '../components/dialogs';
import { Button, ButtonLink, Card, Chip, Segmented, Spinner, cx } from '../components/ui';
import { RESULT_TEXT, type GameView, type Result } from '../game/match';
import {
  backToSetup,
  clearNotice,
  gameInProgress,
  leaveRoom,
  playerAction,
  playerDraw,
  playerMove,
  playerResign,
  rematch,
  roomStore,
  setSetup,
  startGame,
  type RoomScreen,
} from '../game/session';
import { CUSTOM_LIMITS, PRESETS, formatClock, sameTime, timeLabel, type TimeControl } from '../game/time';
import { useSettings } from '../lib/settings';
import { useStore } from '../lib/store';
import { MODES, MODE_TRACK, modeInfo } from '../modes';

/** The room: the host's setup (mode and time control), then the game. */
export function RoomPage() {
  const s = useStore(roomStore);
  const navigate = useNavigate();
  useLeaveOnUnmount(leaveRoom);

  useEffect(() => {
    if (s.notice) {
      notify(s.notice);
      clearNotice();
    }
  }, [s.notice]);

  // A sound when the opponent comes into the room.
  const wasHere = useRef(s.opponentHere);
  useEffect(() => {
    if (s.opponentHere && !wasHere.current && s.phase === 'setup') sfx.join();
    wasHere.current = s.opponentHere;
  }, [s.opponentHere, s.phase]);

  const leave = async () => {
    if (gameInProgress() && !(await confirmDialog({ title: 'Leave the game?', body: 'Leaving now forfeits the game: your opponent wins.', confirm: 'Leave', danger: true }))) return;
    leaveRoom();
    navigate('/');
  };

  if (s.status === 'connecting' || s.status === 'error' || (s.status === 'closed' && !s.game)) return <Connecting s={s} />;
  if (s.phase === 'game' && s.game) return <GameScreen s={s} game={s.game} onLeave={() => void leave()} />;
  return <SetupScreen s={s} />;
}

function Connecting({ s }: { s: RoomScreen }) {
  useMusic('menu');
  return (
    <PageLayout back={{ to: '/', label: 'Home' }}>
      <PageTitle eyebrow="Room" title={s.status === 'connecting' ? (s.role === 'host' ? 'Making a room' : 'Joining') : 'No room'} />
      <Card className="mt-8 max-w-xl p-5">
        {s.status === 'connecting' ? (
          <p className="flex items-center gap-3 text-muted">
            <Spinner />
            {s.role === 'host' ? 'Getting a room code…' : `Connecting to room ${s.code}…`}
          </p>
        ) : (
          <>
            <p className="text-ink">{s.error ?? 'The room is closed.'}</p>
            <ButtonLink to="/" press className="mt-4">
              Back to Home
            </ButtonLink>
          </>
        )}
      </Card>
    </PageLayout>
  );
}

// ---------------------------------------------------------------- setup (mode pick)

function SetupScreen({ s }: { s: RoomScreen }) {
  useMusic('menu');
  const host = s.role === 'host';
  return (
    <PageLayout back={{ to: '/', label: 'Leave room' }}>
      <PageTitle eyebrow={`Room ${s.code}`} title={host ? 'Set up the game' : 'The host is setting up'}>
        {host ? 'Pick the mode and the time control. Colors are drawn at random when the game starts.' : 'The host picks the mode and the time control. Colors are drawn at random when the game starts.'}
      </PageTitle>

      <div className="mt-8 grid gap-5 lg:grid-cols-[2fr_3fr]">
        <div className="grid content-start gap-5">
          <RoomCodeCard code={s.code} host={host} />
          <Card className="p-5">
            <p className="label-caps text-muted">Opponent</p>
            <p className="mt-3 flex items-center gap-3">
              <span className={cx('flex size-9 items-center justify-center rounded-lg', s.opponentHere ? 'bg-accent text-on-accent' : 'bg-raised text-muted')}>
                {s.opponentHere ? <Check className="size-5" /> : host ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-5" />}
              </span>
              <span>{host ? (s.opponentHere ? 'Your opponent is here.' : 'Waiting for someone to join with the code.') : 'You are in the room. Waiting for the host to start.'}</span>
            </p>
            {host && (
              <Button variant="primary" size="xl" press className="mt-5 w-full" disabled={!s.opponentHere} onClick={startGame}>
                <Play className="size-6" />
                Start the game
              </Button>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card className="p-5">
            <p className="label-caps text-muted">Mode</p>
            <div className="mt-3 grid gap-2">
              {MODES.map((m) => {
                const chosen = s.setup.mode === m.id;
                const locked = m.stage !== null;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!host || locked}
                    onClick={() => {
                      sfx.click();
                      setSetup({ mode: m.id });
                    }}
                    className={cx(
                      'flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition',
                      chosen ? 'border-navy bg-raised' : 'border-line bg-surface',
                      host && !locked && !chosen && 'hover:border-navy/50',
                      locked && 'opacity-55',
                      !host && 'cursor-default',
                    )}
                  >
                    <span className={cx('mt-1 size-3 shrink-0 rounded-sm', chosen ? 'bg-accent' : 'bg-line')} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-xl uppercase leading-tight">{m.name}</span>
                      {m.author && <span className="block text-xs text-muted">{m.author}</span>}
                      <span className="mt-1 block text-sm text-muted">{m.blurb}</span>
                    </span>
                    {locked && <Chip className="shrink-0">Stage {m.stage}</Chip>}
                  </button>
                );
              })}
            </div>
          </Card>
          {s.setup.mode === 'pothole' && <PotholeOptions value={s.setup.options.potholeDuration} host={host} />}
          <TimePicker value={s.setup.time} host={host} />
        </div>
      </div>
    </PageLayout>
  );
}

/** Pot-Hole's mode option (spec 7.3, Caleb): how long a pothole stays open. The host sets it. */
function PotholeOptions({ value, host }: { value: 'base' | 'random'; host: boolean }) {
  const label = { base: 'One turn (base rule)', random: '1 to 6 turns (random)' };
  return (
    <Card className="p-5">
      <p className="label-caps text-muted">Pot-Hole: how long a pothole stays open</p>
      {host ? (
        <Segmented
          className="mt-3"
          label="How long a pothole stays open"
          value={value}
          onChange={(v) => {
            sfx.click();
            setSetup({ options: { potholeDuration: v } });
          }}
          options={[
            { value: 'base', label: label.base },
            { value: 'random', label: label.random },
          ]}
        />
      ) : (
        <p className="mt-3 font-display text-2xl uppercase">{label[value]}</p>
      )}
      <p className="mt-2 text-sm text-muted">
        {value === 'base'
          ? 'A pothole blocks its square for the other player’s next turn, then closes.'
          : 'When a pothole opens, a six-sided roll decides how many turns (moves by either player) it stays open.'}
      </p>
    </Card>
  );
}

function TimePicker({ value, host }: { value: TimeControl; host: boolean }) {
  const isPreset = value === null || PRESETS.some((p) => sameTime(p, value));
  const [custom, setCustom] = useState(!isPreset);
  const [minutes, setMinutes] = useState(value?.minutes ?? 10);
  const [increment, setIncrement] = useState(value?.increment ?? 0);
  const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));
  const choose = (t: TimeControl) => {
    setCustom(false);
    setSetup({ time: t });
  };
  const applyCustom = (m: number, i: number) => setSetup({ time: { minutes: clamp(m, CUSTOM_LIMITS.minutes), increment: clamp(i, CUSTOM_LIMITS.increment) } });

  if (!host) {
    return (
      <Card className="p-5">
        <p className="label-caps text-muted">Time control</p>
        <p className="mt-3 font-display text-3xl uppercase">{timeLabel(value)}</p>
        {value && <p className="mt-1 text-sm text-muted">Minutes for each player + seconds added after each move.</p>}
      </Card>
    );
  }
  const option = (label: ReactNode, chosen: boolean, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        sfx.click();
        onClick();
      }}
      className={cx('h-11 rounded-xl border-2 font-display text-lg uppercase transition', chosen ? 'border-navy bg-navy text-on-accent' : 'border-line bg-surface hover:border-navy/50')}
    >
      {label}
    </button>
  );
  return (
    <Card className="p-5">
      <p className="label-caps text-muted">Time control</p>
      <p className="mt-1 text-sm text-muted">Minutes for each player + seconds added after each move.</p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {option('Untimed', !custom && value === null, () => choose(null), 'untimed')}
        {PRESETS.map((p) => option(timeLabel(p), !custom && sameTime(p, value), () => choose(p), timeLabel(p)))}
        {option(
          'Custom',
          custom,
          () => {
            setCustom(true);
            applyCustom(minutes, increment);
          },
          'custom',
        )}
      </div>
      {custom && (
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <NumberField
            label="Minutes"
            value={minutes}
            limits={CUSTOM_LIMITS.minutes}
            onChange={(v) => {
              setMinutes(v);
              applyCustom(v, increment);
            }}
          />
          <NumberField
            label="Seconds added per move"
            value={increment}
            limits={CUSTOM_LIMITS.increment}
            onChange={(v) => {
              setIncrement(v);
              applyCustom(minutes, v);
            }}
          />
        </div>
      )}
    </Card>
  );
}

function NumberField({ label, value, limits, onChange }: { label: string; value: number; limits: readonly [number, number]; onChange: (v: number) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={limits[0]}
        max={limits[1]}
        value={value}
        onChange={(e) => onChange(Math.min(limits[1], Math.max(limits[0], Math.round(Number(e.target.value) || limits[0]))))}
        className="h-11 w-28 rounded-xl border-2 border-navy bg-surface px-3 text-center font-mono text-lg text-ink outline-none focus:ring-3 focus:ring-navy/15"
      />
    </label>
  );
}

// ---------------------------------------------------------------- the game

/** Re-renders every `ms` while `active`, for clocks and countdowns. */
function useTicker(active: boolean, ms = 100) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function GameScreen({ s, game, onLeave }: { s: RoomScreen; game: GameView; onLeave: () => void }) {
  const settings = useSettings();
  const me = s.myColor ?? 'w';
  const them = other(me);
  const over = !!game.result;
  const running = !over && !!game.clock?.running;
  useTicker(running || (!!game.away && !over) || s.reconnecting !== null);
  const [box, size] = useSize<HTMLDivElement>();
  const shakeRef = useRef<HTMLDivElement>(null);
  const { openManual: openGuide, manual } = useGameManual(game.mode);
  useMusic(MODE_TRACK[game.mode] ?? null);
  const { holeHidden } = useGameFx(game, me, s.reconnecting !== null);

  const landscape = size.w >= 700 && size.w >= size.h * 1.15;
  const PANEL = 340;
  const boardSize = Math.max(200, Math.floor(landscape ? Math.min(size.h - 24, size.w - PANEL - 56) : Math.min(size.w - 24, size.h - 2 * 62 - 132)));

  const elapsed = performance.now() - s.gameAt;
  const clockOf = (c: Color) => (game.clock ? (game.clock.running === c ? game.clock[c] - elapsed : game.clock[c]) : null);
  const canMove = !over && s.status === 'open' && s.reconnecting === null && game.pos.turn === me;

  // Effects and sound (Stage 2).
  const runningLeft = game.clock?.running ? clockOf(game.clock.running) : null;
  const tension = !over && (inCheck(game.pos) || (runningLeft !== null && runningLeft < 30_000));
  useEffect(() => setTension(tension), [tension]);
  useClockTicks(clockOf(me), running && game.clock?.running === me);
  const r = game.result;
  const fallen = r && r.winner && (r.reason === 'checkmate' || r.reason === 'resign') ? { color: other(r.winner), slow: r.reason === 'resign' } : null;
  const drained = !!r && r.winner === null && r.reason !== 'forfeit' && r.reason !== 'left';
  const flagged = r && (r.reason === 'timeout' || r.reason === 'timeoutDraw') && game.clock ? (game.clock.w <= 0 ? 'w' : game.clock.b <= 0 ? 'b' : null) : null;

  const board = (
    <Board
      key={game.number}
      pos={game.pos}
      orientation={me}
      canMove={canMove}
      lastMove={game.lastMove}
      showLegal={settings.legalMoves}
      showLast={settings.lastMove}
      onMove={playerMove}
      intro={game.pos.fullmove === 1 && game.pos.turn === 'w' && !over}
      fallen={fallen}
      drained={drained}
      holeHidden={holeHidden}
      showTurns={game.options.potholeDuration === 'random'}
    />
  );
  const opponentBar = (
    <PlayerBar color={them} mine={false} clock={clockOf(them)} toMove={!over && game.pos.turn === them} note={opponentNote(s, game, them, elapsed)} cracked={flagged === them} />
  );
  const myBar = <PlayerBar color={me} mine clock={clockOf(me)} toMove={!over && game.pos.turn === me} note={myNote(s, game, me)} cracked={flagged === me} />;
  const lower = over ? <ResultPanel s={s} game={game} me={me} onLeave={onLeave} onGuide={openGuide} /> : <Actions s={s} game={game} me={me} onLeave={onLeave} onGuide={openGuide} />;

  return (
    <PlayLayout>
      <EffectsLayer shakeRef={shakeRef} />
      <div ref={box} className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden p-3">
        <div ref={shakeRef}>
        {size.w > 0 &&
          (landscape ? (
            <div className="flex items-stretch gap-6">
              <div style={{ width: boardSize }}>{board}</div>
              <aside className="flex flex-col justify-between gap-3" style={{ width: PANEL, height: boardSize }}>
                {opponentBar}
                <div className="flex flex-col gap-3">
                  <ModeTag game={game} />
                  {myBar}
                  {lower}
                </div>
              </aside>
            </div>
          ) : (
            <div className="flex flex-col gap-2" style={{ width: boardSize }}>
              {opponentBar}
              {board}
              {myBar}
              <div className="min-h-[120px]">{lower}</div>
            </div>
          ))}
        </div>
      </div>
      {manual}
    </PlayLayout>
  );
}

function ModeTag({ game }: { game: GameView }) {
  return (
    <p className="label-caps text-muted">
      {modeInfo(game.mode).name} · {timeLabel(game.time)}
    </p>
  );
}

function opponentNote(s: RoomScreen, game: GameView, them: Color, elapsed: number): ReactNode {
  if (game.result) return null;
  if (game.away && game.away.color === them) {
    const left = Math.ceil(Math.max(0, game.away.msLeft - elapsed) / 1000);
    return (
      <span className="flex items-center gap-1 text-warn">
        <WifiOff className="size-3.5" /> Lost connection. Forfeits in {left} s
      </span>
    );
  }
  if (s.role === 'host' && !s.opponentHere) return <span className="text-warn">Not in the room</span>;
  if (game.drawOffer === them) return <span className="text-accent">Offers a draw</span>;
  return game.pos.turn === them ? 'Thinking…' : null;
}

function myNote(s: RoomScreen, game: GameView, me: Color): ReactNode {
  if (game.result) return null;
  if (s.reconnecting !== null) {
    const left = Math.ceil(Math.max(0, s.reconnecting - performance.now()) / 1000);
    return (
      <span className="flex items-center gap-1 text-warn">
        <WifiOff className="size-3.5" /> Connection lost. Reconnecting… {left} s
      </span>
    );
  }
  if (game.drawOffer === me) return 'You offered a draw';
  return game.pos.turn === me ? <span className="text-accent">Your move</span> : null;
}

function PlayerBar({ color, mine, clock, toMove, note, cracked = false }: { color: Color; mine: boolean; clock: number | null; toMove: boolean; note: ReactNode; cracked?: boolean }) {
  const low = clock !== null && clock < 10_000;
  return (
    <div className={cx('flex items-center gap-3 rounded-xl border-2 bg-surface px-3 py-2', mine ? 'border-navy' : 'border-line')}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-raised">
        <PieceArt color={color} kind="K" className="size-9" />
      </span>
      <div className="min-w-0 flex-1">
        {/* The spec's color indicator: always shown in full, never cut short. */}
        <p className="font-display text-xl uppercase leading-none">{mine ? `You are ${COLOR_NAME[color]}` : `Opponent · ${COLOR_NAME[color]}`}</p>
        <p className="mt-1 h-4 truncate text-xs text-muted">{note}</p>
      </div>
      {clock !== null && (
        <span
          className={cx(
            'relative shrink-0 overflow-hidden rounded-lg px-2.5 py-1.5 font-mono text-xl font-semibold tabular-nums',
            cracked ? 'animate-clock-crack bg-danger text-on-accent' : toMove ? (low ? 'animate-clock-low bg-accent text-on-accent' : 'bg-navy text-on-accent') : 'bg-raised text-ink',
          )}
        >
          {formatClock(clock)}
          {/* Out of time: the clock face cracks. */}
          {cracked && (
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <path d="M48 0 L44 12 L53 18 L46 29 L50 40 M44 12 L30 8 L18 14 M53 18 L68 15 L80 22 M46 29 L34 33 M53 18 L60 30" fill="none" stroke="#faeeda" strokeWidth="2.2" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      )}
    </div>
  );
}

function Actions({ s, game, me, onLeave, onGuide }: { s: RoomScreen; game: GameView; me: Color; onLeave: () => void; onGuide: () => void }) {
  const live = s.status === 'open' && s.reconnecting === null;
  const resign = async () => {
    if (await confirmDialog({ title: 'Resign?', body: 'Your opponent wins the game.', confirm: 'Resign', danger: true })) playerResign();
  };
  const theyOffer = game.drawOffer === other(me);
  const myTurn = game.pos.turn === me && live;
  const variant = game.pos.variant;
  const extra = variant === 'remorse' && game.pos.extra !== null && game.pos.extra !== undefined;
  return (
    <div className="grid gap-2">
      {/* Mega Knight: instead of moving a piece, roll; on a 6, move a mega knight. */}
      {variant === 'megaknight' && myTurn && (
        <div className="flex animate-rise items-center gap-2 rounded-xl border-2 border-accent/50 bg-surface px-3 py-2">
          <Dices className="size-5 text-accent" />
          <span className="flex-1 text-sm">{game.pos.mkRoll ? 'You rolled a 6: move a mega knight.' : 'Move a piece, or roll: a 6 moves a mega knight.'}</span>
          {!game.pos.mkRoll && (
            <Button size="sm" variant="primary" press onClick={() => playerAction('roll')}>
              Roll
            </Button>
          )}
        </div>
      )}
      {/* Remorse: a psychopath's extra move. */}
      {extra && myTurn && (
        <div className="flex animate-rise items-center gap-2 rounded-xl border-2 border-accent/50 bg-surface px-3 py-2">
          <Zap className="size-5 text-accent" />
          <span className="flex-1 text-sm">Psychopath: an extra move with the same piece.</span>
          <Button size="sm" press onClick={() => playerAction('skip')}>
            Skip
          </Button>
        </div>
      )}
      {theyOffer && (
        <div className="flex animate-rise flex-wrap items-center gap-2 rounded-xl border-2 border-accent/50 bg-surface px-3 py-2">
          <Handshake className="size-5 text-accent" />
          <span className="flex-1 text-sm">Your opponent offers a draw.</span>
          <Button size="sm" variant="primary" press disabled={!live} onClick={() => playerDraw('accept')}>
            Accept
          </Button>
          <Button size="sm" press disabled={!live} onClick={() => playerDraw('decline')}>
            Decline
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="md" press className="min-w-0 flex-1 px-2" disabled={!live || !!game.drawOffer} onClick={() => playerDraw('offer')}>
          <Handshake className="size-4" />
          {game.drawOffer === me ? 'Draw offered' : 'Offer draw'}
        </Button>
        <Button size="md" variant="danger" press className="min-w-0 flex-1 px-2" disabled={!live} onClick={() => void resign()}>
          <Flag className="size-4" />
          Resign
        </Button>
        <Button size="md" variant="ghost" press className="border-2 border-navy px-3" onClick={onGuide} title="Manual" aria-label="Open the manual">
          <BookOpen className="size-4" />
        </Button>
        <Button size="md" variant="ghost" press className="border-2 border-navy px-3" onClick={onLeave} title="Leave the room">
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function resultTitle(r: Result, me: Color) {
  if (r.winner === null) return 'Draw';
  return r.winner === me ? 'You win' : 'You lose';
}

function resultLine(r: Result, me: Color, game: GameView) {
  const loser = r.winner ? other(r.winner) : null;
  const who = loser === me ? 'You' : 'Your opponent';
  switch (r.reason) {
    case 'timeout':
      return `${who} ran out of time.`;
    case 'timeoutDraw':
      return `${who} ran out of time, but the other side cannot checkmate.`;
    case 'resign':
      return `${who} resigned.`;
    case 'forfeit':
      return `${who} lost connection and did not come back.`;
    case 'left':
      return `${who} left the game.`;
    case 'checkmate':
      return `Checkmate. ${r.winner ? COLOR_NAME[r.winner] : ''} wins.`;
    case 'palace':
      return loser === me ? 'Your palace is empty.' : 'Your opponent’s palace is empty.';
    case 'palaceBoth':
      return 'One move emptied both palaces.';
    case 'kingLost':
      return `${loser === me ? 'Your' : 'Your opponent’s'} king is gone${game.mode === 'megaknight' ? ': crushed by a mega knight' : ''}.`;
    default:
      return `${RESULT_TEXT[r.reason]}.`;
  }
}

function ResultPanel({ s, game, me, onLeave, onGuide }: { s: RoomScreen; game: GameView; me: Color; onLeave: () => void; onGuide: () => void }) {
  const r = game.result!;
  const host = s.role === 'host';
  const open = s.status === 'open';
  return (
    <div className={cx('animate-pop rounded-xl border-2 bg-surface px-4 py-3', r.winner === me ? 'border-accent' : 'border-navy')}>
      <div className="flex items-baseline gap-3">
        <h2 className={cx('text-3xl', r.winner === me && 'text-accent')}>{resultTitle(r, me)}</h2>
        <p className="min-w-0 flex-1 text-sm text-muted">{resultLine(r, me, game)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {host && open && (
          <>
            <Button size="sm" variant="primary" press disabled={!s.opponentHere} onClick={rematch} title={s.opponentHere ? 'Same mode and time control, colors swap' : 'Your opponent is not in the room'}>
              <RefreshCw className="size-4" />
              Rematch
            </Button>
            <Button size="sm" press onClick={backToSetup}>
              <Swords className="size-4" />
              Back to mode pick
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" press className="border-2 border-navy" onClick={onLeave}>
          <LogOut className="size-4" />
          Leave room
        </Button>
        <Button size="sm" variant="ghost" press className="border-2 border-navy" onClick={onGuide} aria-label="Open the manual">
          <BookOpen className="size-4" />
          Manual
        </Button>
      </div>
      {!host && open && <p className="mt-2 text-xs text-muted">The host chooses a rematch or a new mode.</p>}
      {!open && <p className="mt-2 text-xs text-muted">The room is closed.</p>}
    </div>
  );
}
