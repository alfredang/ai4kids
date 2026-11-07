import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { KidsIcon, type KidsIconName } from "@/components/public/KidsIcon";
export const metadata = {
  title: "AI Games for Kids Singapore",
  description:
    "Explore our story adventures, AI art, phonics, coding puzzles, escape rooms and card games. A parent signs in and chooses a child’s profile before play.",
  alternates: { canonical: "/games" },
};
const FRIENDS = ["story", "art", "maths", "science"];
const GAMES: {
  title: string;
  icon: KidsIconName;
  theme: string;
  copy: string;
}[] = [
  {
    title: "Story adventures",
    icon: "book",
    theme: "peach",
    copy: "Dream up a tale. Choose what happens next.",
  },
  {
    title: "AI Art Studio",
    icon: "art",
    theme: "yellow",
    copy: "Big imagination. Your own colourful gallery.",
  },
  {
    title: "Phonics Quest",
    icon: "wand",
    theme: "lilac",
    copy: "Pop sounds, build words and grow reading confidence.",
  },
  {
    title: "Talking Buddy",
    icon: "chat",
    theme: "mint",
    copy: "Ask a curious question. Discover something together.",
  },
  {
    title: "Code puzzles",
    icon: "maths",
    theme: "peach",
    copy: "Think, try and solve one little challenge at a time.",
  },
  {
    title: "Escape rooms & card games",
    icon: "bag",
    theme: "yellow",
    copy: "Find clues, team up and play with friends.",
  },
];
export default function GamesPage() {
  return (
    <div className="kids-marketing">
      <SiteHeader />
      <main id="main-content" className="kids-wrap kids-games-main">
        <div className="kids-games-hero">
          <div>
            <h1>
              Little players. <span>Big adventures!</span>
            </h1>
            <p>
              Our games are ready to explore.{" "}
              <strong>Parents unlock the fun.</strong>
            </p>
            <Link className="kids-button" href="/parent/play">
              Let’s play together <KidsIcon name="arrow" />
            </Link>
          </div>
          <div className="kids-games-friends" aria-hidden="true">
            {FRIENDS.map((friend) => (
              <Image key={friend} src={`/icons/${friend}-friend.webp`} alt="" width={220} height={220} />
            ))}
          </div>
        </div>
        <div className="kids-games-grid">
          {GAMES.map((game) => (
            <article
              key={game.title}
              className={`kids-game-preview kids-${game.theme}`}
            >
              <KidsIcon name={game.icon} />
              <h2>{game.title}</h2>
              <p>{game.copy}</p>
            </article>
          ))}
        </div>
        <p className="kids-games-note">
          <strong>One parent login.</strong> Choose your child’s profile, then
          explore the playground together. AI text uses DeepSeek V4.1 Flash;
          some puzzles and games use prepared content.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
