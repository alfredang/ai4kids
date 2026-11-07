/** Public canonical host is independent of the local Auth.js callback URL. */
export const PUBLIC_SITE_URL = "https://ai4kids.tertiarycourses.com.sg";

export type WorkshopFaq = { question: string; answer: string };

export const WORKSHOP_SEO: Record<
  string,
  {
    title: string;
    description: string;
    /** Replaces "<title> Singapore" in the <title> tag when it would run too long. */
    metaTitle?: string;
    /** Long-form copy for workshops that target their own search terms. */
    guide?: { heading: string; paragraphs: string[] };
    faqs?: WorkshopFaq[];
  }
> = {
  "creative-story-writing": {
    title: "Creative Writing with AI for Kids",
    metaTitle: "Creative Writing & Storytelling with AI for Kids",
    description:
      "Creative writing with AI for kids in Singapore: storytelling, characters and an illustrated storybook your child authors. Ask about December workshops.",
    guide: {
      heading: "Storytelling with AI: your child stays the author",
      paragraphs: [
        "Creative writing with AI works best when AI is a brainstorming partner, not the writer. Your child invents the hero, the setting and the little problem to solve, then asks for ideas and decides which ones to keep.",
        "Every suggestion gets rewritten in their own voice. That is where the writing happens: choosing words, shaping a beginning, middle and happy ending, and sharing the finished story with you.",
        "For under-13s, a grown-up operates ChatGPT and helps with the prompts. AutoDraw turns doodles into a cover, so your child finishes with an illustrated storybook of their own.",
      ],
    },
    faqs: [
      {
        question: "Will AI write the story for my child?",
        answer:
          "No. AI offers ideas, and your child chooses what to keep and rewrites it in their own voice. The characters, the plot and the ending are their decisions.",
      },
      {
        question: "Is this the same as a composition class?",
        answer:
          "No. It is a playful holiday workshop about imagination and storytelling, not exam composition practice. Children make a storybook they can be proud of.",
      },
      {
        question: "What age is this storytelling workshop for?",
        answer:
          "The suggested age range is 7–12. Grown-ups help with reading and prompts, so tell us your child’s age and we will recommend a suitable option.",
      },
      {
        question: "When is the next creative writing workshop?",
        answer:
          "Ask about the December 2026 holiday workshops. Our team will confirm dates, session length, venue or online format and fees before you book.",
      },
    ],
  },
  "creative-content-studio": {
    title: "Creative AI Workshop for Kids",
    description:
      "A creative AI workshop for kids in Singapore. Make colourful posters and comics with your child using free AI tools. Enquire about December workshops.",
  },
  "ai-maths-detectives": {
    title: "AI for Math",
    description:
      "Explore AI for math with kids in Singapore. Solve maths mysteries, explain your thinking and check AI hints together. Ask about December holiday workshops.",
  },
  "ai-science-explorers": {
    title: "AI for Science",
    description:
      "Discover AI for science with kids in Singapore. Train a simple classifier and investigate the world together. Ask about December school holiday workshops.",
  },
};
