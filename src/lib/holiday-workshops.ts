/** Workshop concepts; dates, venues and fees are confirmed by the team. */
export const HOLIDAY_WORKSHOPS = [
  {
    slug: "creative-story-writing",
    title: "Storybook Studio",
    shortTitle: "Creative story writing with AI",
    subject: "Storytelling",
    emoji: "📖",
    theme: "peach",
    ageMin: 7,
    ageMax: 12,
    summary: "Dream up a Merlion adventure. Make it your own.",
    takeaway: "Your own illustrated storybook",
    tool: "Parent-operated ChatGPT + AutoDraw",
    steps: [
      "Invent a hero, a setting and a little problem to solve.",
      "Ask AI for ideas, then choose and rewrite them in your own voice.",
      "Draw a cover and share your beginning, middle and happy ending.",
    ],
    parentNote:
      "You help with the prompts; your child makes the story decisions. For under-13s, the adult operates ChatGPT.",
  },
  {
    slug: "creative-content-studio",
    title: "Mini Maker Studio",
    shortTitle: "Creative content generation with AI",
    subject: "Art & creativity",
    emoji: "🎨",
    theme: "yellow",
    ageMin: 7,
    ageMax: 12,
    summary: "Make a poster and a mini comic.",
    takeaway: "Your poster and mini comic",
    tool: "AutoDraw + parent-operated ChatGPT",
    steps: [
      "Choose a cause or a character you care about.",
      "Try AI-assisted sketches and write your own catchy captions.",
      "Arrange your drawings into a poster and tell its story.",
    ],
    parentNote:
      "Create side by side, talk about original ideas and credit the tools that helped.",
  },
  {
    slug: "ai-maths-detectives",
    title: "Maths Detectives",
    shortTitle: "AI for maths workshop",
    subject: "Maths",
    emoji: "🔎",
    theme: "mint",
    ageMin: 8,
    ageMax: 12,
    summary: "Solve number mysteries, one clue at a time.",
    takeaway: "Your maths detective journal",
    tool: "Parent-operated ChatGPT + paper bar models",
    steps: [
      "Turn a familiar Singapore situation into a word problem.",
      "Ask for one hint at a time and draw your own bar model.",
      "Check the arithmetic and explain why your answer makes sense.",
    ],
    parentNote:
      "The goal is reasoning, not copying answers. We question AI suggestions and check every solution together.",
  },
  {
    slug: "ai-science-explorers",
    title: "Science Explorers",
    shortTitle: "AI for science workshop",
    subject: "Science",
    emoji: "🌱",
    theme: "lilac",
    ageMin: 8,
    ageMax: 12,
    summary: "Teach a computer to spot leaves and flowers.",
    takeaway: "Your first AI science experiment",
    tool: "Google Teachable Machine",
    steps: [
      "Observe leaves and flowers and group their visible features.",
      "Train an image model using drawings or object photos, without faces.",
      "Test new examples, spot mistakes and explain what the model learned.",
    ],
    parentNote:
      "A grown-up guides the experiment. Use objects or drawings and keep personal photos out of the project.",
  },
] as const;

export const FAMILY_FAQS = [
  {
    question: "Is this for my child, or for us together?",
    answer:
      "Both! These December workshop concepts are designed around a parent and child learning side by side. Tell us your child’s age and interests and our team will recommend a suitable option and confirm the attendance format.",
  },
  {
    question: "Does my child need to know coding or AI?",
    answer:
      "No prior AI or coding experience is needed for these introductory activities. Children bring their imagination; adults help with reading, prompts and checking the results. The suggested age range is 7–12, depending on the workshop.",
  },
  {
    question: "When and where are the December workshops?",
    answer:
      "Ask about the December 2026 holiday workshops using the enquiry form or WhatsApp. Our team will confirm available dates, session length, venue or online format, fees and what to bring before you book. Submitting an enquiry does not reserve or purchase a place.",
  },
  {
    question: "Do we need paid AI subscriptions?",
    answer:
      "The activities use free tools or free tiers, with no paid AI subscription required for the proposed activities. Free-tier limits and availability can change. We will confirm the tool setup before your session.",
  },
  {
    question: "How do younger children use AI tools?",
    answer:
      "A parent or facilitator operates tools that require an adult. ChatGPT is not for children under 13 to use directly; for an educational activity with younger children, the adult conducts the interaction. We practise keeping personal information private and checking AI answers.",
  },
] as const;

export function workshopWhatsAppUrl(number: string, workshop?: string) {
  const message = workshop
    ? `Hi! I'm interested in the December 2026 AI Kids workshop: ${workshop}. Could you share the dates, fees and parent-child format?`
    : "Hi! I'm interested in the December 2026 AI workshops for my child. Could you share the dates, fees and parent-child options?";
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
