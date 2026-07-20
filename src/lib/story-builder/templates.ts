/**
 * Story Builder — the offline story engine. The child picks a hero, place, magic
 * item and mood; this weaves a short branching tale from randomized beats, so the
 * same picks read differently each time. Ported from the ai4kids Android app
 * (StoryBuilderScreen.kt). When AI is configured the API writes a fresh story in
 * the same shape (see /api/learn/story-builder), falling back to this on failure.
 *
 * The tale forks TWICE — first how to solve the trouble, then what to do with the
 * magic afterwards — so there are four possible endings and a replay reads
 * differently. The second fork is OPTIONAL in the type: an AI story that omits or
 * malforms it still plays as a shorter single-fork tale instead of being thrown
 * away (see the sanitizer in the route).
 *
 * Pure + dependency-free — this also runs in the browser when the API call fails.
 */

export type Choice = { emoji: string; name: string };

export const HEROES: Choice[] = [
  { emoji: "🦊", name: "Fox" }, { emoji: "🐉", name: "Dragon" },
  { emoji: "🤖", name: "Robot" }, { emoji: "🦄", name: "Unicorn" },
  { emoji: "🐼", name: "Panda" }, { emoji: "🦉", name: "Owl" },
  { emoji: "🐢", name: "Turtle" }, { emoji: "🐱", name: "Kitten" },
];
export const PLACES: Choice[] = [
  { emoji: "🏰", name: "castle" }, { emoji: "🌋", name: "volcano" },
  { emoji: "🌌", name: "galaxy" }, { emoji: "🏝️", name: "island" },
  { emoji: "🌲", name: "forest" }, { emoji: "💧", name: "waterfall" },
  { emoji: "🏔️", name: "snowy peak" }, { emoji: "🪸", name: "coral reef" },
];
export const OBJECTS: Choice[] = [
  { emoji: "🗝️", name: "golden key" }, { emoji: "🔮", name: "magic orb" },
  { emoji: "🎈", name: "balloon" }, { emoji: "📕", name: "spell book" },
  { emoji: "🏮", name: "lantern" }, { emoji: "🧭", name: "compass" },
  { emoji: "🪶", name: "feather" }, { emoji: "🎶", name: "music box" },
];
// A mood/trait is threaded through the prose so the same hero can feel brave one
// time and silly the next — changing the whole tone of the story.
export const MOODS: Choice[] = [
  { emoji: "🦁", name: "brave" }, { emoji: "🤪", name: "silly" },
  { emoji: "😴", name: "sleepy" }, { emoji: "🤔", name: "curious" },
  { emoji: "💖", name: "kind" }, { emoji: "🧠", name: "clever" },
  { emoji: "😄", name: "cheerful" }, { emoji: "🙈", name: "shy" },
];

/** One way the child can solve a problem. `pages` are read straight after the
 *  pick. `problem` + `choiceA`/`choiceB`, when present, pose a follow-up fork —
 *  they're optional so a story with only one fork is still valid and playable. */
export type Branch = {
  emoji: string;
  label: string;
  pages: string[];
  problem?: string;
  choiceA?: Branch;
  choiceB?: Branch;
};

/** A branching story. `pre` are the pages read before the first fork; `problem`
 *  is that fork, where the child picks `choiceA` or `choiceB`. */
export type Story = { pre: string[]; problem: string; choiceA: Branch; choiceB: Branch };

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
/** "a" vs "an" — PLACES has `island`, so a naive "a ${place}" reads wrong.
 *  Exported so check:story-builder can assert it never emits "a island". */
export const an = (word: string): string => (/^[aeiou]/i.test(word) ? "an" : "a");

const celebrations = (h: Choice, p: Choice, o: Choice): string[] => [
  `Everyone cheered for the ${h.name} ${h.emoji}! The ${p.name} ${p.emoji} sparkled brighter than ever. ✨`,
  `What a day! The ${h.name} ${h.emoji} laughed and danced with all the new friends. 🎶`,
  `The ${o.name} ${o.emoji} hummed a happy tune, and the whole ${p.name} ${p.emoji} joined in. 🎵`,
  `Hooray! The ${h.name} ${h.emoji} jumped for joy as the ${p.name} ${p.emoji} filled with giggles. 😄`,
  `Confetti swirled through the ${p.name} ${p.emoji} as everyone thanked the ${h.name} ${h.emoji}. 🎊`,
  `The ${o.name} ${o.emoji} glittered happily, and the ${p.name} ${p.emoji} felt warm and bright. 🌟`,
  `Every creature in the ${p.name} ${p.emoji} clapped and cheered for the little ${h.name} ${h.emoji}. 👏`,
  `The ${h.name} ${h.emoji} took a bow, and the ${p.name} ${p.emoji} rang with happy laughter. 🥳`,
];

const endings = (h: Choice, p: Choice, m: Choice): string[] => [
  `With a happy heart, the ${m.name} ${h.name} ${h.emoji} shared the magic with every friend. The End! 🎉`,
  `And so the ${h.name} ${h.emoji} and all the friends celebrated together. The End! 🎉`,
  `From that day on, the ${p.name} ${p.emoji} was the happiest place of all. The End! 🎉`,
  `And the ${m.name} ${h.name} ${h.emoji} went home with the best story to tell. The End! 🎉`,
  `Tucked in that night, the ${h.name} ${h.emoji} smiled, dreaming of new adventures. The End! 🌙`,
  `Forever after, the ${h.name} ${h.emoji} and the ${p.name} ${p.emoji} were the best of friends. The End! 🎉`,
  `The stars came out over the ${p.name} ${p.emoji}, and the ${h.name} ${h.emoji} yawned a happy yawn. The End! 🌙`,
  `And every story after that one started right here, in the ${p.name} ${p.emoji}. The End! 📖`,
];

/**
 * The second fork: after the trouble is solved, what to do with the magic. A
 * different *kind* of decision than the first, so it doesn't read as a repeat.
 *
 * Exported because the API grafts this onto the AI's branches rather than asking
 * the model for the whole two-fork tree: measured, a nested prompt costs ~58s
 * (median) vs ~22s for the first act alone, which is far too long a wait for a
 * child. The AI writes the first act; this supplies the second — same
 * ingredients, so it reads consistently — for four endings at no latency cost.
 */
export function secondFork(h: Choice, p: Choice, o: Choice, m: Choice): Required<Pick<Branch, "problem" | "choiceA" | "choiceB">> {
  const twist = pick([
    `Just then, the ${o.name} ${o.emoji} began to glow — one last sparkle of magic was left inside!`,
    `On the way home, the ${h.name} ${h.emoji} spotted a tiny door tucked into the ${p.name} ${p.emoji}.`,
    `Then the ${o.name} ${o.emoji} gave a soft hum, as if it had one more secret to share.`,
    `As the sun dipped low, the ${p.name} ${p.emoji} filled with a warm golden glow.`,
    `Just then, a friendly breeze carried a faraway giggle across the ${p.name} ${p.emoji}.`,
    `Suddenly the ${o.name} ${o.emoji} felt warm, and a little map shimmered across the ${p.name} ${p.emoji}.`,
  ]);
  const celebration = celebrations(h, p, o);
  const ending = endings(h, p, m);

  return {
    problem: `${twist}\nWhat should the ${h.name} ${h.emoji} do now?`,
    // Branch A — be generous with the magic.
    choiceA: {
      emoji: "🎁",
      label: "Share the magic",
      pages: [
        pick([
          `"This belongs to all of us!" said the ${h.name} ${h.emoji}, passing the ${o.name} ${o.emoji} around the ${p.name} ${p.emoji}. 💛`,
          `The ${m.name} ${h.name} ${h.emoji} shared the last of the magic, and every friend got a little sparkle of their own. 💛`,
          `One by one, the ${h.name} ${h.emoji} gave everyone a turn with the ${o.name} ${o.emoji}. 💛`,
        ]),
        pick(celebration),
        pick(ending),
      ],
    },
    // Branch B — keep the adventure going.
    choiceB: {
      emoji: "🗺️",
      label: "Go exploring",
      pages: [
        pick([
          `The ${h.name} ${h.emoji} held the ${o.name} ${o.emoji} high and set off to see what else the ${p.name} ${p.emoji} was hiding! 🗺️`,
          `Off went the ${m.name} ${h.name} ${h.emoji}, following the glow to a secret corner of the ${p.name} ${p.emoji}. 🗺️`,
          `"Let's find out!" cheered the ${h.name} ${h.emoji}, and the whole ${p.name} ${p.emoji} came along. 🗺️`,
        ]),
        pick(celebration),
        pick(ending),
      ],
    },
  };
}

export function buildStory(h: Choice, p: Choice, o: Choice, m: Choice): Story {
  const opening = pick([
    `Once upon a time, ${an(m.name)} ${m.name} ${h.name} ${h.emoji} lived near ${an(p.name)} ${p.name} ${p.emoji}.`,
    `Long ago, in a faraway ${p.name} ${p.emoji}, there lived a ${m.name} little ${h.name} ${h.emoji}.`,
    `Every morning, ${an(m.name)} ${m.name} ${h.name} ${h.emoji} woke up right beside ${an(p.name)} ${p.name} ${p.emoji}.`,
    `In a cozy corner of the ${p.name} ${p.emoji}, ${an(m.name)} ${m.name} ${h.name} ${h.emoji} was just waking up.`,
    `There once was ${an(m.name)} ${m.name} ${h.name} ${h.emoji} who loved the ${p.name} ${p.emoji} more than anywhere else.`,
    `Far past the clouds, ${an(m.name)} ${m.name} ${h.name} ${h.emoji} made a home by ${an(p.name)} ${p.name} ${p.emoji}.`,
    `Where the sun rose over ${an(p.name)} ${p.name} ${p.emoji}, ${an(m.name)} ${m.name} ${h.name} ${h.emoji} was humming a little tune.`,
    `Nobody in the ${p.name} ${p.emoji} was quite as ${m.name} as one small ${h.name} ${h.emoji}.`,
  ]);
  const discovery = pick([
    `One sunny day, the ${h.name} found ${an(o.name)} ${o.name} ${o.emoji} hidden in the tall grass!`,
    `While exploring the ${p.name}, the ${h.name} ${h.emoji} spotted ${an(o.name)} ${o.name} ${o.emoji}!`,
    `Then, with a twinkle, ${an(o.name)} ${o.name} ${o.emoji} appeared right in front of the ${h.name}!`,
    `As the ${h.name} ${h.emoji} skipped along, a shiny ${o.name} ${o.emoji} caught the light!`,
    `Tucked under an old tree, the ${h.name} ${h.emoji} discovered ${an(o.name)} ${o.name} ${o.emoji}.`,
    `What's this? The ${h.name} ${h.emoji} had never seen ${an(o.name)} ${o.name} ${o.emoji} quite like it before.`,
    `Something sparkled in the shadows — ${an(o.name)} ${o.name} ${o.emoji}, waiting to be found!`,
    `Right there, half-buried in the ${p.name} ${p.emoji}, lay ${an(o.name)} ${o.name} ${o.emoji}.`,
  ]);
  const journey = pick([
    `The ${m.name} ${h.name} ${h.emoji} tucked the ${o.name} ${o.emoji} away and set off deep into the ${p.name} ${p.emoji}.`,
    `Step by step, the ${h.name} ${h.emoji} wandered further into the ${p.name} ${p.emoji}, the ${o.name} ${o.emoji} glowing softly.`,
    `Full of wonder, the ${h.name} ${h.emoji} explored every winding corner of the ${p.name} ${p.emoji}.`,
    `Holding the ${o.name} ${o.emoji} close, the ${h.name} ${h.emoji} marched bravely on through the ${p.name} ${p.emoji}.`,
    `The ${o.name} ${o.emoji} seemed to point the way, so the ${h.name} ${h.emoji} followed it across the ${p.name} ${p.emoji}.`,
    `Humming a happy tune, the ${m.name} ${h.name} ${h.emoji} skipped deeper into the ${p.name} ${p.emoji}.`,
    `With the ${o.name} ${o.emoji} safe in hand, the ${h.name} ${h.emoji} tiptoed where nobody had been before.`,
    `The ${p.name} ${p.emoji} stretched out wide, and the ${m.name} ${h.name} ${h.emoji} could not wait to see it all.`,
  ]);
  const trouble = pick([
    `But then — uh oh! A grumpy troll stomped across the ${p.name} ${p.emoji} and blocked the way.`,
    `Suddenly a big storm cloud rolled over the ${p.name} ${p.emoji}, and everything went dark.`,
    `Just then, a tiny lost cub began to cry at the edge of the ${p.name} ${p.emoji}.`,
    `Oh no! A wobbly old bridge over the ${p.name} ${p.emoji} began to creak and sway.`,
    `All at once, a thick fog rolled across the ${p.name} ${p.emoji} and hid the path.`,
    `Then a sleepy giant snored so loudly that the whole ${p.name} ${p.emoji} shook!`,
    `Uh oh — a tangle of vines had grown right across the ${p.name} ${p.emoji} overnight.`,
    `Just then, a little bird flapped down, too tired to fly home across the ${p.name} ${p.emoji}.`,
  ]);
  const problem = `${trouble}\nWhat should the ${m.name} ${h.name} ${h.emoji} do?`;

  return {
    pre: [opening, discovery, journey],
    problem,
    // Branch A — be clever and use the magic item.
    choiceA: {
      emoji: o.emoji,
      label: `Use the ${o.name}`,
      pages: [
        pick([
          `The ${h.name} ${h.emoji} held up the ${o.name} ${o.emoji}. With a bright flash of magic, the trouble melted away! ✨`,
          `Quick as a wink, the ${h.name} ${h.emoji} waved the ${o.name} ${o.emoji} — and poof! the problem was gone. ✨`,
          `The clever ${h.name} ${h.emoji} pointed the ${o.name} ${o.emoji} just right, and everything turned out perfectly! ✨`,
          `One gentle tap of the ${o.name} ${o.emoji}, and the ${p.name} ${p.emoji} was safe and sound again. ✨`,
        ]),
      ],
      ...secondFork(h, p, o, m),
    },
    // Branch B — be kind and call friends for help.
    choiceB: {
      emoji: "🤝",
      label: "Call for friends",
      pages: [
        pick([
          `The ${h.name} ${h.emoji} called out for help. Friends came running, and together they fixed everything in no time! 🤝`,
          `The ${h.name} ${h.emoji} whistled, and kind friends arrived to lend a hand. Together, they sorted it out! 🤝`,
          `With a big friendly shout, the ${h.name} ${h.emoji} gathered everyone, and as a team they made it all okay! 🤝`,
          `"Together!" cheered the ${h.name} ${h.emoji} — and every friend in the ${p.name} ${p.emoji} pitched in. 🤝`,
        ]),
      ],
      ...secondFork(h, p, o, m),
    },
  };
}

/* ===================== Timeline (playback along a chosen path) =====================
 * Moved out of the storytelling page component so it's pure, unit-testable
 * (check:story-builder), and reachable from the API — matching Android's split of
 * StoryEngine.kt (this logic) vs StoryBuilderScreen.kt (the UI). */

/** A node that can pose a fork — the story root, or any branch with a follow-up. */
export type ForkNode = { problem?: string; choiceA?: Branch; choiceB?: Branch };

/**
 * Flatten the story along the path chosen so far. The tale forks up to twice, so
 * the page list grows as the child decides: `forks[k]` is the page index of the
 * k-th fork, and it's answered by `chosen[k]`. The first unanswered fork is
 * therefore `forks[chosen.length]` — that's where the child is deciding now.
 */
export function buildTimeline(story: Story, chosen: Branch[]): { pages: string[]; forks: number[] } {
  const pages = [...story.pre, story.problem];
  const forks = [story.pre.length];
  for (const b of chosen) {
    pages.push(...b.pages);
    if (b.problem && b.choiceA && b.choiceB) {
      pages.push(b.problem);
      forks.push(pages.length - 1);
    }
  }
  return { pages, forks };
}

/** Pages still to come if the child keeps picking A — used only to show a total.
 *  Both branches are the same length in generated stories; an AI story may differ
 *  slightly, so this is an estimate (as the single-fork version was too). */
export function remainingFrom(node: ForkNode | null): number {
  const b = node?.choiceA;
  if (!b) return 0;
  return b.pages.length + (b.problem && b.choiceA && b.choiceB ? 1 + remainingFrom(b) : 0);
}
