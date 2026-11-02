const FRIENDS: Record<string, string> = { Storytelling: "story", "Art & creativity": "art", Maths: "maths", Science: "science" };
/** Original characters generated for AI Kids; no stock emoji illustrations. */
export function WorkshopSticker({ subject }: { subject: string }) {
  return <img className="kids-workshop-sticker" src={`/icons/${FRIENDS[subject] ?? "story"}-friend.webp`} width={600} height={600} alt="" loading="lazy" />;
}
