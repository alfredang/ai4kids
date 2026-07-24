import { db } from "@/db";
import { users } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-role";
import { SavedToast } from "@/app/admin/_components/SavedToast";
import { requireAdminRole } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

async function ensureAdmin() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    redirect("/admin");
  }
  return session;
}

export default async function UsersPage() {
  await ensureAdmin();
  const list = await db.select().from(users).orderBy(asc(users.email));

  async function createUser(formData: FormData) {
    "use server";
    await requireAdminRole();
    await ensureAdmin();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "author");
    if (!email || !name || password.length < 8) {
      redirect("/admin/users?err=invalid");
    }
    if (!["admin", "editor", "author"].includes(role)) {
      redirect("/admin/users?err=role");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      await db.insert(users).values({
        email,
        name,
        passwordHash,
        role: role as "admin" | "editor" | "author",
      });
    } catch {
      redirect("/admin/users?err=duplicate");
    }
    revalidatePath("/admin/users");
    redirect("/admin/users?saved=1");
  }

  async function updateRole(formData: FormData) {
    "use server";
    await requireAdminRole();
    await ensureAdmin();
    const id = Number(formData.get("id"));
    const role = String(formData.get("role") ?? "");
    if (!id || !["admin", "editor", "author"].includes(role)) {
      redirect("/admin/users?err=role");
    }
    await db
      .update(users)
      .set({ role: role as "admin" | "editor" | "author" })
      .where(eq(users.id, id));
    revalidatePath("/admin/users");
    redirect("/admin/users?saved=1");
  }

  async function resetPassword(formData: FormData) {
    "use server";
    await requireAdminRole();
    await ensureAdmin();
    const id = Number(formData.get("id"));
    const password = String(formData.get("password") ?? "");
    if (!id || password.length < 8) redirect("/admin/users?err=password");
    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));
    revalidatePath("/admin/users");
    redirect("/admin/users?saved=1");
  }

  async function deleteUser(formData: FormData) {
    "use server";
    await requireAdminRole();
    const session = await ensureAdmin();
    const id = Number(formData.get("id"));
    if (!id) redirect("/admin/users?err=id");
    if (String(id) === session.id) redirect("/admin/users?err=self");
    await db.delete(users).where(eq(users.id, id));
    revalidatePath("/admin/users");
    redirect("/admin/users?saved=1");
  }

  return (
    <div>
      <SavedToast />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Users</h1>
      </div>

      <div className="glass p-6 mb-6">
        <h2 className="font-display text-lg font-semibold mb-1">Add user</h2>
        <p className="text-xs text-(--color-muted) mb-4">
          Authors can only access the Posts area of the admin (create/edit their own posts).
          Editors can manage all content but not users or credentials. Admins have full access.
        </p>
        <form action={createUser} className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="kicker block mb-2">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm"
            />
          </div>
          <div>
            <label className="kicker block mb-2">Name</label>
            <input
              name="name"
              required
              className="w-full px-3 py-2 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm"
            />
          </div>
          <div>
            <label className="kicker block mb-2">Password (min 8)</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full px-3 py-2 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition text-sm font-mono"
            />
          </div>
          <div>
            <label className="kicker block mb-2">Role</label>
            <select
              name="role"
              defaultValue="author"
              className="w-full px-3 py-2 bg-white/3 border border-white/10 rounded-lg focus:outline-none focus:border-(--color-cyan) text-sm"
            >
              <option value="author">Author</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary">Add user</button>
          </div>
        </form>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-white/5 text-left text-xs uppercase text-white/60">
            <tr>
              <th className="px-3 py-2 w-[26%]">Email</th>
              <th className="px-3 py-2 w-[22%]">Name</th>
              <th className="px-3 py-2 w-[18%]">Role</th>
              <th className="px-3 py-2 w-[34%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-t border-white/5 hover:bg-white/5 align-middle">
                <td className="px-3 py-2 truncate">{u.email}</td>
                <td className="px-3 py-2 truncate">{u.name}</td>
                <td className="px-3 py-2">
                  <form action={updateRole} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="px-2 py-1 bg-white/3 border border-white/10 rounded text-xs"
                    >
                      <option value="author">Author</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button className="px-2 py-1 text-xs border border-white/10 rounded hover:bg-white/5">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={resetPassword} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <input
                        type="password"
                        name="password"
                        minLength={8}
                        placeholder="New password"
                        className="px-2 py-1 bg-white/3 border border-white/10 rounded text-xs font-mono w-32"
                      />
                      <button className="px-2 py-1 text-xs border border-white/10 rounded hover:bg-white/5">
                        Reset
                      </button>
                    </form>
                    <form action={deleteUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="px-2 py-1 text-xs border border-red-500/40 text-red-400 rounded hover:bg-red-500/10">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/50">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
