import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getParentChildren } from "@/lib/portal-queries";
import { PLAY_PROFILE_COOKIE } from "@/lib/learner-session";
import { KidsIcon } from "@/components/public/KidsIcon";

export const metadata = {
  title: "Play together",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function PlayTogether() {
  const parent = await getPortalSession();
  if (!parent || parent.role !== "parent") redirect("/login?parentRequired=1");
  const children = await getParentChildren(Number(parent.id));
  async function chooseChild(data: FormData) {
    "use server";
    const session = await getPortalSession();
    if (!session || session.role !== "parent")
      redirect("/login?parentRequired=1");
    const allowed = await getParentChildren(Number(session.id));
    const id = Number(data.get("childId"));
    if (!allowed.some((child) => child.id === id)) redirect("/parent/play");
    (await cookies()).set(PLAY_PROFILE_COOKIE, String(id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });
    redirect("/learn");
  }
  return (
    <section className="mx-auto max-w-2xl">
      <KidsIcon name="bag" style={{ width: 80, height: 80 }} />
      <h1 className="font-fun text-3xl font-bold text-violet-800">
        Who’s playing today?
      </h1>
      <p className="mt-3 text-lg text-slate-600">
        Pick your child’s profile and explore together. Stories, art, phonics,
        puzzles and more!
      </p>
      {children.length ? (
        <form action={chooseChild} className="mt-6 grid gap-4 sm:grid-cols-2">
          {children.map((child) => (
            <button
              key={child.id}
              name="childId"
              value={child.id}
              className="rounded-[2rem] border-2 border-violet-200 bg-white p-6 text-left text-xl font-bold text-violet-800 shadow-sm transition hover:-translate-y-1 hover:bg-violet-50"
            >
              <KidsIcon
                name="sun"
                style={{ width: 48, height: 48, marginBottom: 8 }}
              />
              Play with {child.name} →
            </button>
          ))}
        </form>
      ) : (
        <Link
          href="/parent/children/new"
          className="mt-6 inline-block rounded-2xl bg-violet-600 px-6 py-3 text-lg font-bold text-white"
        >
          Add your child’s profile →
        </Link>
      )}
      <p className="mt-6 text-slate-600">
        AI text adventures use <strong>DeepSeek V4.1 Flash</strong>. Keep
        personal details out of game prompts and check AI answers together.
      </p>
    </section>
  );
}
