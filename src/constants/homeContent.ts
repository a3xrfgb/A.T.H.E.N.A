/** Curated inspiration quotes — diverse figures from many countries and eras (English text). */
export const INSPIRATION_QUOTES: readonly { quote: string; author: string }[] = [
  {
    quote: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
  },
  {
    quote: "Simplicity is the ultimate sophistication.",
    author: "Leonardo da Vinci",
  },
  {
    quote: "Make it work, make it right, make it fast.",
    author: "Kent Beck",
  },
  {
    quote: "Strive not to be a success, but rather to be of value.",
    author: "Albert Einstein",
  },
  {
    quote: "Nothing in life is to be feared, it is only to be understood.",
    author: "Marie Curie",
  },
  {
    quote: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    quote:
      "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
    author: "Maya Angelou",
  },
  {
    quote: "Darkness cannot drive out darkness; only light can do that.",
    author: "Martin Luther King Jr.",
  },
  {
    quote: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius",
  },
  {
    quote: "The journey of a thousand miles begins with one step.",
    author: "Lao Tzu",
  },
  {
    quote: "Raise your words, not voice. It is rain that grows flowers, not thunder.",
    author: "Rumi",
  },
  {
    quote: "You can't cross the sea merely by standing and staring at the water.",
    author: "Rabindranath Tagore",
  },
  {
    quote: "In the midst of chaos, there is also opportunity.",
    author: "Sun Tzu",
  },
  {
    quote: "Everything you can imagine is real.",
    author: "Pablo Picasso",
  },
  {
    quote: "Be yourself; everyone else is already taken.",
    author: "Oscar Wilde",
  },
  {
    quote: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
  },
  {
    quote: "Even the darkest night will end and the sun will rise.",
    author: "Victor Hugo",
  },
  {
    quote: "The only thing worse than being blind is having sight but no vision.",
    author: "Helen Keller",
  },
  {
    quote: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    quote: "Spread love everywhere you go.",
    author: "Mother Teresa",
  },
  {
    quote: "How wonderful it is that nobody need wait a single moment before starting to improve the world.",
    author: "Anne Frank",
  },
  {
    quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
  },
  {
    quote: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt",
  },
  {
    quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
  },
  {
    quote: "The unexamined life is not worth living.",
    author: "Socrates",
  },
  {
    quote: "You have power over your mind—not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
  },
  {
    quote: "It's not what happens to you, but how you react to it that matters.",
    author: "Epictetus",
  },
  {
    quote: "Tell me and I forget. Teach me and I remember. Involve me and I learn.",
    author: "Benjamin Franklin",
  },
  {
    quote: "I have not failed. I've just found 10,000 ways that won't work.",
    author: "Thomas Edison",
  },
  {
    quote: "Whether you think you can, or you think you can't—you're right.",
    author: "Henry Ford",
  },
  {
    quote: "Turn your wounds into wisdom.",
    author: "Oprah Winfrey",
  },
  {
    quote: "Happiness is not something ready-made. It comes from your own actions.",
    author: "Dalai Lama",
  },
  {
    quote: "Do your little bit of good where you are; it's those little bits of good put together that overwhelm the world.",
    author: "Desmond Tutu",
  },
  {
    quote: "And, when you want something, all the universe conspires in helping you to achieve it.",
    author: "Paulo Coelho",
  },
  {
    quote: "Pain is inevitable. Suffering is optional.",
    author: "Haruki Murakami",
  },
  {
    quote: "If you don't like someone's story, write your own.",
    author: "Chinua Achebe",
  },
  {
    quote: "Knowledge is power. Information is liberating.",
    author: "Kofi Annan",
  },
  {
    quote: "One child, one teacher, one book, one pen can change the world.",
    author: "Malala Yousafzai",
  },
  {
    quote: "The best time to plant a tree was twenty years ago. The second best time is now.",
    author: "Chinese proverb",
  },
  {
    quote: "Small deeds done are better than great deeds planned.",
    author: "Peter Marshall",
  },
  {
    quote: "Focus is a matter of deciding what you are not going to do.",
    author: "John Carmack",
  },
  {
    quote: "Ship early, ship often.",
    author: "Startup wisdom",
  },
  {
    quote: "Not all those who wander are lost.",
    author: "J.R.R. Tolkien",
  },
  {
    quote: "Life is what happens when you're busy making other plans.",
    author: "John Lennon",
  },
  {
    quote: "The mind is everything. What you think you become.",
    author: "Buddha",
  },
  {
    quote: "If you want to lift yourself up, lift up someone else.",
    author: "Booker T. Washington",
  },
  {
    quote: "The greatest glory in living lies not in never falling, but in rising every time we fall.",
    author: "Nelson Mandela",
  },
  {
    quote: "If you can dream it, you can do it.",
    author: "Walt Disney",
  },
  {
    quote: "Peace begins with a smile.",
    author: "Mother Teresa",
  },
  {
    quote: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
  },
];

const INSPIRATION_SESSION_KEY = "athena.homeInspirationIndex";

function readSessionQuoteIndex(len: number): number | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(INSPIRATION_SESSION_KEY);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0 || n >= len) return null;
    return n;
  } catch {
    return null;
  }
}

function writeSessionQuoteIndex(n: number): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(INSPIRATION_SESSION_KEY, String(n));
  } catch {
    /* private mode or quota */
  }
}

/**
 * One quote per app session: random on first open, stable until the app is closed.
 * Closing and reopening the app clears `sessionStorage`, so a new quote is chosen.
 */
export function inspirationForSession(): { quote: string; author: string } {
  const len = INSPIRATION_QUOTES.length;
  let idx = readSessionQuoteIndex(len);
  if (idx === null) {
    idx = Math.floor(Math.random() * len);
    writeSessionQuoteIndex(idx);
  }
  return INSPIRATION_QUOTES[idx];
}

/** @deprecated Use {@link inspirationForSession} — kept for any stray imports. */
export function inspirationForToday(): { quote: string; author: string } {
  return inspirationForSession();
}

export const WORK_SUGGESTIONS: readonly string[] = [
  "Outline your goal in one sentence, then break it into three concrete tasks.",
  "Review yesterday’s chat for one idea worth turning into a small experiment today.",
  "Spend twenty minutes in Chat on a single problem—you’ll thank yourself later.",
  "Open Study and skim one topic you’ve been postponing; note three takeaways.",
  "Create a new project folder and drop one reference file to anchor the work.",
  "Try a quick image prompt in Gallery to visualize the outcome you want.",
  "Pick one chat thread to rename so your sidebar reflects what matters now.",
  "Draft a message to Athena explaining the blocker; often writing clarifies it.",
  "Batch similar tasks: models, then chat, then notes—context switching is expensive.",
  "End the day by writing a single line in Notes: what moved forward?",
  "Skim your gallery saves for a color palette or mood for today’s creative work.",
  "Set a timer for deep work; silence notifications until it rings.",
];

export function workSuggestionForToday(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return WORK_SUGGESTIONS[dayOfYear % WORK_SUGGESTIONS.length];
}
