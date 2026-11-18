// Fun robot moves the chat can ask for ("dance for me", "do the moonwalk", "nacho", "ڈانس کرو").
// Handled in the browser only: no AI call, no cost. The chat sends a window event; the robot launcher listens.

export type DanceId = 'robot' | 'moonwalk' | 'disco' | 'bhangra' | 'twist' | 'spin' | 'breakdance' | 'jump';

export const DANCES: { id: DanceId; name: string; ur: string; emoji: string; words: RegExp }[] = [
  { id: 'robot', name: 'Robot dance', ur: 'روبوٹ ڈانس', emoji: '🤖', words: /\brobot(ic)?\s*dance\b|روبوٹ/ },
  { id: 'moonwalk', name: 'Moonwalk', ur: 'مون واک', emoji: '🌙', words: /moon\s*walk|مون\s*واک/ },
  { id: 'disco', name: 'Disco', ur: 'ڈسکو', emoji: '🪩', words: /disco|ڈسکو/ },
  { id: 'bhangra', name: 'Bhangra', ur: 'بھنگڑا', emoji: '🥁', words: /bhangra|bhangda|بھنگڑا|بھنگڑہ/ },
  { id: 'twist', name: 'Twist', ur: 'ٹوئسٹ', emoji: '🌀', words: /twist|ٹوئسٹ/ },
  { id: 'spin', name: 'Spin', ur: 'گھومنا', emoji: '💫', words: /\bspin\b|\bghoom|گھوم/ },
  { id: 'breakdance', name: 'Breakdance', ur: 'بریک ڈانس', emoji: '🔥', words: /break\s*dance|breaking|بریک/ },
  { id: 'jump', name: 'Happy jump', ur: 'خوشی کی چھلانگ', emoji: '🎉', words: /\bjump|\bhop\b|chalang|چھلانگ|کود/ },
];

export const ROBOT_EVENT = 'orbinexa-robot-move';

// Is this message a request to dance? Returns the dance, 'random' for "dance for me", or null.
export function detectDance(text: string): DanceId | 'random' | null {
  const t = text.toLowerCase();
  const wantsDance = /\bdanc(e|ing)\b|\bnach(o|na|ein|ain)?\b|\bnaach|\bnaacho|ناچ|ڈانس|رقص|ٹھمکا/.test(t);
  const named = DANCES.find((d) => d.words.test(t));
  // a dance name alone ("moonwalk", "bhangra please") is enough; "jump"/"spin" only count with a fun request
  if (named && (wantsDance || !['jump', 'spin'].includes(named.id) || /\b(do|show|please|karo|kar|plz|for me)\b|کرو|کریں/.test(t))) {
    return named.id;
  }
  // "how do I ... dance" style questions are rare here; any dance word means "dance for me"
  return wantsDance ? 'random' : null;
}

export function pickDance(id: DanceId | 'random'): (typeof DANCES)[number] {
  if (id !== 'random') return DANCES.find((d) => d.id === id) ?? DANCES[0];
  return DANCES[Math.floor(Math.random() * DANCES.length)];
}

export function askRobotToDance(id: DanceId) {
  window.dispatchEvent(new CustomEvent(ROBOT_EVENT, { detail: { dance: id } }));
}

// Short chat reply (English + Urdu), the robot itself does the rest
export function danceReply(d: (typeof DANCES)[number]): string {
  const others = DANCES.filter((x) => x.id !== d.id)
    .map((x) => x.name.toLowerCase())
    .join(', ');
  return (
    `Yes! Watch me do the ${d.name} ${d.emoji} (look at the middle of the screen)\n` +
    `ضرور! دیکھیں، میں ${d.ur} کر رہا ہوں ${d.emoji}\n\n` +
    `I can also do: ${others}. Just ask, for example "do the moonwalk".`
  );
}
