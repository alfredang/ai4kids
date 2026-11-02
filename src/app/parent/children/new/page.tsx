import { PlayfulText } from "@/components/public/PlaySymbol";
import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, parentChildren } from "@/db/schema";
import { getPortalSession } from "@/lib/portal-session";
import { AGE_BANDS, ageBandForAge } from "@/lib/portal-content";

export const dynamic = "force-dynamic";

export default async function NewChildPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;

  async function addChild(formData: FormData) {
    "use server";
    const sess = await getPortalSession();
    if (!sess || sess.role !== "parent") redirect("/login");
    const parentId = Number(sess!.id);

    const name = String(formData.get("name") || "").trim();
    const username = String(formData.get("username") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const age = Number(formData.get("age") || 0);
    if (!name || username.length < 3 || password.length < 4) {
      redirect("/parent/children/new?err=invalid");
    }

    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (taken) redirect("/parent/children/new?err=taken");

    const passwordHash = await bcrypt.hash(password, 10);
    const band = ageBandForAge(age);
    const [kid] = await db
      .insert(users)
      .values({
        name,
        username,
        passwordHash,
        role: "learner",
        ageGroup: band?.slug ?? null,
        avatar: "🧒",
      })
      .returning();
    await db.insert(parentChildren).values({ parentId, childId: kid.id });
    redirect("/parent/children");
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/parent/children" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
        ← My kids
      </Link>
      <div className="mt-4 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-amber-100">
        <h1 className="font-fun text-2xl font-700 text-slate-900"><PlayfulText text={"Add your child 🧒"} /></h1>
        <p className="mt-1 text-sm text-slate-500">
          Create your child’s profile. You’ll sign in as a parent to unlock their games.
        </p>
        {err && (
          <p className="mt-3 rounded-2xl bg-coral/10 p-3 text-sm text-coral">
            {err === "taken"
              ? "That username is taken — try another."
              : "Please check the form (username ≥ 3 chars, secret word ≥ 4 chars)."}
          </p>
        )}
        <form action={addChild} className="mt-5 space-y-4">
          <Field label="Child's name" name="name" placeholder="e.g. Maya" />
          <Field label="Username (for login)" name="username" placeholder="e.g. maya-star" autoCap="none" />
          <Field label="Secret word (password)" name="password" type="password" placeholder="something easy to remember" />
          <div>
            <label className="font-fun font-600 text-sm text-slate-600">Age</label>
            <select
              name="age"
              defaultValue="8"
              className="mt-1 w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3 font-round text-lg outline-none focus:border-coral"
            >
              {Array.from({ length: 13 }, (_, i) => i + 4).map((a) => (
                <option key={a} value={a}>{a} years old</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Bands: {AGE_BANDS.map((b) => b.slug).join(" · ")}
            </p>
          </div>
          <button className="w-full rounded-2xl bg-sky-500 py-3 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-[1.02]"><PlayfulText text={" Create kid account 🎉 "} /></button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  autoCap,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  autoCap?: "none";
}) {
  return (
    <div>
      <label className="font-fun font-600 text-sm text-slate-600">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoCapitalize={autoCap}
        required
        className="mt-1 w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3 font-round text-lg outline-none focus:border-coral"
      />
    </div>
  );
}
