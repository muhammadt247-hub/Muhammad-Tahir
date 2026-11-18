'use client';

// The robot button at the bottom RIGHT of every page (the coffee banner is on the left).
// The chat window is only downloaded when someone opens it, so pages do not get slower.
// A small "Need help? Ask me" bubble (English + Urdu) sits next to the robot so everyone knows what it is for.
// Every 15 seconds the robot hops over to a section on the screen (packages, CSV generator, search...),
// cheers, shows a tip for that section, and runs back to its corner. Tapping the robot or the tip opens the chat.

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { RobotMascot } from '@/components/assistant/RobotIcon';
import { DANCES, ROBOT_EVENT, pickDance, type DanceId } from '@/lib/assistant/robot-moves';

const AssistantPanel = dynamic(() => import('@/components/assistant/AssistantPanel').then((m) => m.AssistantPanel), {
  ssr: false,
  loading: () => (
    <div className="fixed bottom-24 right-4 z-50 rounded-2xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground shadow-xl">
      Starting the assistant...
    </div>
  ),
});

const HINT_KEY = 'orbinexa-assistant-hint-hidden';
const TOUR_OFF_KEY = 'orbinexa-robot-tour-off';
const WAIT_MS = 15_000; // time between trips
const RUN_MS = 1_200; // running there (and back)
const STAY_MS = 4_500; // showing the tip
const MAX_TRIPS = 8; // per page, so it never becomes annoying
const DANCE_MS = 7_000; // how long a dance lasts
const INVITE_MS = 9_000; // how long "May I dance for you?" waits for an answer
const INVITE_TRIP = 3; // the 3rd trip of a visit asks "May I dance for you?"
const INVITE_KEY = 'orbinexa-robot-dance-asked';

interface Tip {
  en: string;
  ur: string;
  ask: string; // question sent to the assistant when the tip is tapped
}

// What the robot says next to each section (sections have data-robot-spot="...")
const TIPS: Record<string, Tip> = {
  packages: {
    en: 'Want a cheap tool? I can find the best package for you!',
    ur: 'سستا پیکج چاہیے؟ میں ڈھونڈ دوں گا!',
    ask: 'Show me the cheapest packages',
  },
  offers: {
    en: 'Look, live offers! Ask me which deal is best.',
    ur: 'لائیو آفرز! پوچھیں کون سی بہترین ہے۔',
    ask: 'Show me current offers',
  },
  csv: {
    en: 'Press Generate All, then Export CSV. Need help? I can explain every step!',
    ur: 'یہاں Generate All دبائیں، پھر CSV نکالیں۔ میں سمجھا دوں گا!',
    ask: 'How do I generate titles and keywords and export the CSV?',
  },
  settings: {
    en: 'Choose Gemini or Groq, Metadata or Prompt here. Ask me which is best!',
    ur: 'یہاں سیٹنگز چنیں۔ پوچھیں کون سی بہتر ہے!',
    ask: 'Which settings should I choose in the CSV generator?',
  },
  platform: {
    en: 'Pick Adobe Stock, Shutterstock or Freepik here. I know their rules!',
    ur: 'یہاں سٹاک سائٹ چنیں۔ مجھے ان کے اصول معلوم ہیں!',
    ask: 'What are the title and keyword rules for Adobe Stock, Shutterstock and Freepik?',
  },
  upload: {
    en: 'Drop your images here. Ask me what happens next!',
    ur: 'تصاویر یہاں ڈالیں، پھر مجھ سے پوچھیں!',
    ask: 'How do I upload images and generate titles and keywords?',
  },
  search: {
    en: 'Tell me a tool name, I will find the cheapest one!',
    ur: 'ٹول کا نام بتائیں، سب سے سستا ڈھونڈ دوں گا!',
    ask: 'Find the cheapest Canva package',
  },
  tools: {
    en: 'Remove backgrounds, convert images, make SVGs. Ask me how!',
    ur: 'بیک گراؤنڈ ہٹائیں، SVG بنائیں، مجھ سے پوچھیں!',
    ask: 'Which image tools are on this site and how do I use them?',
  },
  dance: {
    en: 'I can help with packages, CSV files and tools. Tap me!',
    ur: 'میں پیکجز، CSV اور ٹولز میں مدد کرتا ہوں۔ مجھے دبائیں!',
    ask: 'What can you help me with?',
  },
};

type Phase = 'home' | 'going' | 'there' | 'back';
type Kind = 'tip' | 'invite' | 'dance';

interface Trip {
  phase: Phase;
  dx: number;
  dy: number;
  spot: string;
  tipSide: 'left' | 'right';
  fromDx: number; // how far it went sideways (to face the right way on the way back)
  tipBelow: boolean; // robot is high on the screen: tip goes under it so it never covers the top bar
  kind: Kind; // tip about a section, "May I dance for you?", or dancing in the middle of the screen
  dance: DanceId;
}

const HOME: Trip = {
  phase: 'home',
  dx: 0,
  dy: 0,
  spot: 'dance',
  tipSide: 'left',
  fromDx: 0,
  tipBelow: false,
  kind: 'tip',
  dance: 'robot',
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* private mode: fine */
  }
}

// Sections that are on the screen now (not hidden, not tiny)
function visibleSpots(): HTMLElement[] {
  const vh = window.innerHeight;
  return [...document.querySelectorAll<HTMLElement>('[data-robot-spot]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 60 && r.height > 24 && r.top < vh - 140 && r.bottom > 90 && TIPS[el.dataset.robotSpot ?? ''];
  });
}

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [ask, setAsk] = useState<{ id: number; text: string } | null>(null);
  // Hidden until we know whether the person closed it earlier in this visit (avoids a flash)
  const [hintHidden, setHintHidden] = useState(true);
  const [trip, setTrip] = useState<Trip>(HOME);

  const robotRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLDivElement>(null); // invisible marker of the robot's corner (never moves)
  const timers = useRef<number[]>([]);
  const tripsDone = useRef(0);
  const lastSpot = useRef('');
  const stopped = useRef(false); // chat opened or tours switched off
  const loopRef = useRef<() => void>(() => {}); // starts the next trip (set inside the trip loop)

  useEffect(() => {
    const hidden = readFlag(HINT_KEY);
    // small delay so the bubble appears after the page has settled
    const t = window.setTimeout(() => setHintHidden(hidden), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // The trip loop: wait, run to a section on the screen, cheer + tip, run back, wait again
  useEffect(() => {
    stopped.current = readFlag(TOUR_OFF_KEY);

    function startTrip() {
      if (stopped.current || tripsDone.current >= MAX_TRIPS) return;
      const robot = homeRef.current;
      const busyTyping =
        document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      const notReallyVisible = document.visibilityState !== 'visible' || window.innerWidth < 300 || window.innerHeight < 300;
      if (!robot || notReallyVisible || busyTyping || document.querySelector('[role="dialog"]')) {
        later(startTrip, WAIT_MS);
        return;
      }
      tripsDone.current += 1;

      // 3rd trip of the visit: run to the middle and ask "May I dance for you?" (once per visit)
      if (tripsDone.current === INVITE_TRIP && !readFlag(INVITE_KEY)) {
        writeFlag(INVITE_KEY);
        goToMiddle('invite', 'robot', INVITE_MS);
        return;
      }

      // measured from the fixed marker, so a run-back that has not finished drawing cannot spoil the next trip
      const home = robot.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spots = visibleSpots();
      const fresh = spots.filter((s) => s.dataset.robotSpot !== lastSpot.current);
      const pick = (fresh.length ? fresh : spots)[Math.floor(Math.random() * (fresh.length ? fresh : spots).length)];

      let next: Trip;
      if (!pick || prefersReducedMotion()) {
        // nothing to visit (or the person prefers less motion): a little dance in the corner
        next = {
          phase: 'there',
          dx: 0,
          dy: 0,
          spot: pick?.dataset.robotSpot ?? 'dance',
          tipSide: 'left',
          fromDx: 0,
          tipBelow: false,
          kind: 'tip',
          dance: 'robot',
        };
      } else {
        const r = pick.getBoundingClientRect();
        const w = home.width;
        const h = home.height;
        // stand on the top edge of the section, a bit right of its middle, always fully on screen
        const x = Math.min(Math.max(r.left + r.width * 0.62 - w / 2, 8), vw - w - 8);
        const y = Math.min(Math.max(r.top - h * 0.6, 70), vh - h - 8);
        next = {
          phase: 'going',
          dx: Math.round(x - home.left),
          dy: Math.round(y - home.top),
          spot: pick.dataset.robotSpot ?? 'dance',
          tipSide: x + w / 2 > vw / 2 ? 'left' : 'right',
          fromDx: Math.round(x - home.left),
          tipBelow: y < vh * 0.4,
          kind: 'tip',
          dance: 'robot',
        };
      }
      lastSpot.current = next.spot;
      setTrip(next);

      const travel = next.phase === 'going' ? RUN_MS : 0;
      later(() => setTrip((t) => ({ ...t, phase: 'there' })), travel);
      later(() => setTrip((t) => ({ ...t, phase: 'back', dx: 0, dy: 0 })), travel + STAY_MS);
      later(
        () => {
          setTrip(HOME);
          later(startTrip, WAIT_MS);
        },
        travel * 2 + STAY_MS,
      );
    }

    loopRef.current = startTrip;
    if (!stopped.current) later(startTrip, WAIT_MS);
    return clearTimers;
    // runs once; the helpers it calls only use refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run to the middle of the screen, then ask "May I dance for you?" or dance; then run back home
  function goToMiddle(kind: 'invite' | 'dance', dance: DanceId, stayMs: number) {
    clearTimers();
    const home = homeRef.current?.getBoundingClientRect();
    if (!home) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = vw / 2 - home.width / 2;
    const y = Math.max(vh * (kind === 'invite' ? 0.55 : 0.45) - home.height / 2, 80);
    const dx = Math.round(x - home.left);
    const dy = Math.round(y - home.top);
    setTrip({ phase: 'going', dx, dy, spot: 'dance', tipSide: 'left', fromDx: dx, tipBelow: false, kind, dance });
    later(() => setTrip((t) => ({ ...t, phase: 'there' })), RUN_MS);
    later(() => goHome(), RUN_MS + stayMs);
  }

  // Run back to the corner and (unless the trips were stopped) continue the trip loop later
  function goHome() {
    clearTimers();
    setTrip((t) => (t.phase === 'home' ? t : { ...t, phase: 'back', dx: 0, dy: 0 }));
    later(() => {
      setTrip(HOME);
      if (!stopped.current) later(() => loopRef.current(), WAIT_MS);
    }, RUN_MS);
  }

  // The chat (or the invite) asks the robot to dance
  useEffect(() => {
    const onMove = (e: Event) => {
      const detail = (e as CustomEvent<{ dance?: DanceId; invite?: boolean }>).detail;
      if (detail?.dance) goToMiddle('dance', detail.dance, DANCE_MS);
      else if (detail?.invite) goToMiddle('invite', 'robot', INVITE_MS);
    };
    window.addEventListener(ROBOT_EVENT, onMove);
    return () => window.removeEventListener(ROBOT_EVENT, onMove);
    // goToMiddle only uses refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTours = (forGood: boolean) => {
    stopped.current = true;
    clearTimers();
    setTrip(HOME);
    if (forGood) writeFlag(TOUR_OFF_KEY);
  };

  const openChat = (question?: string) => {
    stopTours(false);
    setEverOpened(true);
    if (question) {
      setAsk({ id: Date.now(), text: question });
      setOpen(true);
    } else {
      setOpen((o) => !o);
    }
  };

  const hideHint = () => {
    setHintHidden(true);
    writeFlag(HINT_KEY);
    // closing the help bubble also means "stop running around"
    stopTours(true);
  };

  const away = trip.phase !== 'home';
  const tip = TIPS[trip.spot] ?? TIPS.dance;
  const moving = trip.phase === 'going' || trip.phase === 'back';
  // faces the way it runs: going left when the section is to the left, coming back the other way
  const goingLeft = trip.phase === 'going' ? trip.fromDx < 0 : trip.fromDx > 0;
  const dancing = trip.kind === 'dance' && trip.phase === 'there';
  const inMiddle = trip.kind !== 'tip';
  const dance = DANCES.find((d) => d.id === trip.dance) ?? DANCES[0];

  const answerInvite = (yes: boolean) => {
    if (yes) goToMiddle('dance', pickDance('random').id, DANCE_MS);
    else goHome();
  };

  return (
    <>
      {everOpened && <AssistantPanel open={open} onClose={() => setOpen(false)} ask={ask} />}

      {!open && !hintHidden && !away && (
        <div className="robot-hint fixed bottom-10 right-[4.25rem] z-40 flex items-center sm:bottom-12 sm:right-[5.6rem]">
          <button
            type="button"
            onClick={() => openChat()}
            data-no-pop
            className="relative rounded-2xl rounded-br-md border border-primary/40 bg-card/95 py-1.5 pl-3 pr-7 text-left shadow-lg shadow-primary/15 backdrop-blur-md transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="block text-[13px] font-semibold leading-tight text-foreground">
              Need help? <span className="text-primary">Ask me</span> 👋
            </span>
            <span dir="rtl" className="block text-[12px] leading-snug text-muted-foreground">
              مدد چاہیے؟ مجھ سے پوچھیں
            </span>
          </button>
          <button
            type="button"
            onClick={hideHint}
            aria-label="Hide this help message and stop the robot walking around"
            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* same size and place as the robot at home; used only for measuring */}
      <div
        ref={homeRef}
        aria-hidden="true"
        className="pointer-events-none invisible fixed bottom-1 right-2 z-0 h-[73px] w-[56px] sm:bottom-2 sm:right-3 sm:h-[91px] sm:w-[70px]"
      />
      <div
        ref={robotRef}
        className={'robot-dock fixed bottom-1 right-2 sm:bottom-2 sm:right-3 ' + (inMiddle ? 'z-[60]' : 'z-[45]')}
        style={{
          transform: `translate(${trip.dx}px, ${trip.dy}px)`,
          transition: moving ? `transform ${RUN_MS}ms cubic-bezier(.45,.05,.35,1)` : undefined,
        }}
      >
        {/* "May I dance for you?" */}
        {trip.kind === 'invite' && trip.phase === 'there' && (
          <div className="robot-tip absolute bottom-[92%] left-1/2 w-[min(250px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-primary/40 bg-card px-3 py-2.5 text-center shadow-xl shadow-primary/20">
            <p className="text-[14px] font-bold leading-snug text-foreground">May I dance for you? 💃🕺</p>
            <p dir="rtl" className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              کیا میں آپ کے لیے ڈانس کروں؟
            </p>
            <div className="mt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => answerInvite(true)}
                className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                Yes, dance! / ہاں
              </button>
              <button
                type="button"
                onClick={() => answerInvite(false)}
                className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                No thanks / نہیں
              </button>
            </div>
          </div>
        )}

        {/* dance name and music notes while dancing */}
        {dancing && (
          <>
            <div className="robot-tip pointer-events-none absolute bottom-[100%] left-1/2 mb-14 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-lg">
              {dance.emoji} {dance.name}!
            </div>
            <span aria-hidden="true" className="robot-note pointer-events-none absolute -left-12 -top-4 text-2xl text-primary" style={{ animationDelay: '0s' }}>♪</span>
            <span aria-hidden="true" className="robot-note pointer-events-none absolute -right-12 top-0 text-3xl text-emerald-500" style={{ animationDelay: '0.6s' }}>♫</span>
            <span aria-hidden="true" className="robot-note pointer-events-none absolute -left-8 top-12 text-xl text-primary" style={{ animationDelay: '1.2s' }}>♪</span>
          </>
        )}

        {/* tip bubble while the robot is visiting a section */}
        {trip.kind === 'tip' && trip.phase === 'there' && !open && (
          <button
            type="button"
            onClick={() => openChat(tip.ask)}
            data-no-pop
            className={
              'robot-tip absolute w-[min(230px,calc(100vw-6rem))] rounded-2xl border border-primary/40 bg-card px-3 py-2 text-left shadow-xl shadow-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
              (trip.tipBelow ? 'top-[75%] ' : 'bottom-[70%] ') +
              (trip.tipSide === 'left'
                ? 'right-[85%] ' + (trip.tipBelow ? 'rounded-tr-md' : 'rounded-br-md')
                : 'left-[85%] ' + (trip.tipBelow ? 'rounded-tl-md' : 'rounded-bl-md'))
            }
          >
            <span className="block text-[13px] font-semibold leading-snug text-foreground">{tip.en}</span>
            <span dir="rtl" className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
              {tip.ur}
            </span>
            <span className="mt-1 block text-[11px] font-bold text-primary">Tap to ask me →</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => openChat()}
          aria-label={open ? 'Close the Orbinexa AI Assistant' : 'Open the Orbinexa AI Assistant. Ask for help'}
          aria-expanded={open}
          title="Need help? Ask the Orbinexa AI Assistant"
          className={
            'robot-launcher group relative block w-[56px] rounded-2xl transition-[scale] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-[70px] [&>svg]:h-auto [&>svg]:w-full ' +
            (moving ? 'robot-running ' : '') +
            (moving && goingLeft ? 'robot-face-left ' : '') +
            (trip.phase === 'there' && trip.kind === 'tip' ? 'robot-cheer ' : '') +
            (trip.phase === 'there' && trip.kind === 'invite' ? 'robot-cheer ' : '') +
            (dancing ? 'robot-dance robot-dance-' + trip.dance : '')
          }
        >
          <RobotMascot size={70} animated={!open || inMiddle} />
          {!open && !away && (
            <span
              className="pointer-events-none absolute right-1 top-[18%] h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background"
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    </>
  );
}
