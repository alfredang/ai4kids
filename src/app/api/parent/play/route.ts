import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getPortalSession } from "@/lib/portal-session";
import { getParentChildren } from "@/lib/portal-queries";
import { PLAY_PROFILE_COOKIE } from "@/lib/learner-session";

async function parentId() {
  const session = await getPortalSession();
  if (!session || session.role !== "parent") return null;
  const [parent] = await db.select({id:users.id}).from(users)
    .where(and(eq(users.id,Number(session.id)),eq(users.role,"parent"))).limit(1);
  return parent?.id ?? null;
}
export async function GET() {
  const id=await parentId();
  if(!id)return NextResponse.json({error:"Parent login required"},{status:403});
  const children=await getParentChildren(id);
  return NextResponse.json({children:children.map(({id,name,ageGroup})=>({id,name,ageGroup}))},{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(request:Request) {
  const id=await parentId();
  if(!id)return NextResponse.json({error:"Parent login required"},{status:403});
  const body=z.object({childId:z.number().int().positive()}).safeParse(await request.json().catch(()=>null));
  if(!body.success)return NextResponse.json({error:"Choose a child profile"},{status:400});
  const child=(await getParentChildren(id)).find(child=>child.id===body.data.childId);
  if(!child)return NextResponse.json({error:"This profile is not linked to your account"},{status:403});
  (await cookies()).set(PLAY_PROFILE_COOKIE,String(child.id),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:4*60*60});
  return NextResponse.json({ok:true,child:{id:child.id,name:child.name}},{headers:{"Cache-Control":"private, no-store"}});
}
