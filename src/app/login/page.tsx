import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { KidsIcon, type KidsIconName } from "@/components/public/KidsIcon";
import { PipMascot } from "@/components/public/PipMascot";
import { FamilyLoginForm } from "@/components/public/FamilyLoginForm";

export const metadata: Metadata = {
  title: "Family Login",
  description:
    "Parents sign in, choose a child’s profile and explore stories, art, maths and science together.",
  alternates: { canonical: "/login" },
};

const WELCOME: { icon: KidsIconName; title: string; copy: string }[] = [
  { icon: "home", title: "One login for your family", copy: "Every child’s profile sits under your account." },
  { icon: "heart", title: "You stay in charge", copy: "A grown-up signs in and chooses who plays." },
  { icon: "book", title: "Pick up where you left off", copy: "Stories, art and games, all saved together." },
];

export default function LoginPage() {
  return (
    <div className="kids-marketing">
      <SiteHeader />
      <main id="main-content" className="kids-wrap kids-signin">
        <section className="kids-signin-welcome">
          <p className="kids-plain-label">Welcome, families</p>
          <h1>
            Welcome back! <span>Big ideas are waiting.</span>
          </h1>
          <p>Sign in to explore stories, art, maths and science with your child.</p>
          <ul>
            {WELCOME.map((item) => (
              <li key={item.title}>
                <KidsIcon name={item.icon} />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.copy}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="kids-signin-scene">
            <Image
              src="/images/family-ai-banner.webp"
              alt="Illustration of two Singapore families exploring AI together on a laptop and tablet"
              fill
              priority
              sizes="(max-width: 900px) 0px, 700px"
            />
            <div className="kids-signin-pip" aria-hidden="true">
              <PipMascot />
            </div>
          </div>
          <Link className="kids-text-link" href="/#workshops">
            New here? Peek at our December workshops →
          </Link>
        </section>
        <section aria-label="Sign in">
          <FamilyLoginForm />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
