import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, parentChildren } from "@/db/schema";
import { currentStaffRole } from "@/lib/admin-guard";

/** Provisions only an isolated, synthetic store-review family. Never accepts
 * arbitrary roles, real child details or an existing family's email address. */
export async function POST(request: Request) {
  if (await currentStaffRole() !== "admin") return NextResponse.json({error:"Administrator required"},{status:403});
  const input=z.object({password:z.string().min(20).max(128)}).safeParse(await request.json().catch(()=>null));
  if(!input.success)return NextResponse.json({error:"A strong review password is required"},{status:400});
  const email="appreview-ai4kids@tertiaryinfotech.com";
  const name="AI4Kids App Review Parent";
  const username="ai4kids-review-demo";
  const hash=await bcrypt.hash(input.data.password,12);
  try {
    const result=await db.transaction(async tx=>{
      let [parent]=await tx.select().from(users).where(eq(users.email,email)).limit(1);
      if(parent && (parent.role!=="parent" || parent.name!==name))throw new Error("conflict");
      if(!parent)[parent]=await tx.insert(users).values({email,name,role:"parent",passwordHash:hash}).returning();
      else await tx.update(users).set({passwordHash:hash}).where(eq(users.id,parent.id));
      let [child]=await tx.select().from(users).where(eq(users.username,username)).limit(1);
      if(child){
        const [link]=await tx.select().from(parentChildren).where(and(eq(parentChildren.parentId,parent.id),eq(parentChildren.childId,child.id))).limit(1);
        if(!link || child.role!=="learner" || child.name!=="Sunny Demo")throw new Error("conflict");
      } else {
        [child]=await tx.insert(users).values({username,name:"Sunny Demo",role:"learner",ageGroup:"7-9"}).returning();
        await tx.insert(parentChildren).values({parentId:parent.id,childId:child.id});
      }
      return {parentId:parent.id,childId:child.id};
    });
    return NextResponse.json({ok:true,email,...result},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return NextResponse.json({error:"Review account conflicts with an existing record"},{status:409}); }
}
