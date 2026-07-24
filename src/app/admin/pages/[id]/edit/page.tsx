import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PostEditorForm, type PostFormData } from "@/components/admin/PostEditorForm";
import type { JSONContent } from "@tiptap/react";
import { requireStaff } from "@/lib/admin-guard";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pageId = Number(id);
  if (!Number.isFinite(pageId)) notFound();
  const [p] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  if (!p) notFound();

  // WordPress-imported pages have a placeholder TipTap doc and real body in
  // contentHtml. Feed the HTML to the editor so editors see actual content.
  const isWpPlaceholder =
    JSON.stringify(p.content).includes("(Imported from WordPress)");
  const editorContent: JSONContent | string =
    isWpPlaceholder && p.contentHtml
      ? p.contentHtml
      : (p.content as JSONContent);

  const initial: PostFormData = {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? "",
    content: editorContent,
    contentHtml: p.contentHtml ?? "",
    status: p.status,
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    seoKeywords: p.seoKeywords ?? "",
    ogImage: p.ogImage ?? "",
    featuredImage: "",
  };

  async function save(data: PostFormData) {
    "use server";
    await requireStaff();
    await db
      .update(pages)
      .set({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        content: data.content,
        contentHtml: data.contentHtml,
        status: data.status,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        seoKeywords: data.seoKeywords || null,
        ogImage: data.ogImage || null,
        publishedAt:
          data.status === "published" && !p.publishedAt ? new Date() : p.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, data.id));
    revalidatePath(`/${data.slug}`);
    revalidatePath("/"); // homepage may link to top-level pages
    revalidatePath("/sitemap.xml");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Page</h1>
      <PostEditorForm initial={initial} save={save} kind="page" />
    </div>
  );
}
