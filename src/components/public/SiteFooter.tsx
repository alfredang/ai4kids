import Link from "next/link";
import { KidsLogo } from "@/components/public/KidsLogo";
import { MarketingMotion } from "@/components/public/MarketingMotion";

export function SiteFooter() {
  return (
    <footer className="kids-site-footer">
      <div className="kids-wrap kids-footer-top">
        <div>
          <KidsLogo />
          <p>
            For the stories they’ll tell.
            <br />
            And the memories you’ll keep.
          </p>
          <span className="kids-footer-location">
            Made for curious families in Singapore ♡
          </span>
        </div>
        <div>
          <h3>Let’s explore</h3>
          <Link href="/holiday-workshops">AI kids workshops in Singapore</Link>
          <Link href="/holiday-workshops/creative-story-writing">
            Creative writing with AI
          </Link>
          <Link href="/ai-for-stem">AI for STEM</Link>
          <Link href="/programs">All programmes</Link>
          <Link href="/games">Explore games</Link>
          <Link href="/#free-tools">Free AI toolbox</Link>
          <Link href="/downloads/family-ai-starter-pack.html">
            Free family activity pack
          </Link>
        </div>
        <div>
          <h3>For your family</h3>
          <Link href="/login">Family login</Link>
          <Link href="/parent">Parent dashboard</Link>
          <Link href="/free-trial">Ask about a free trial</Link>
          <Link href="/contact">Contact our team</Link>
        </div>
        <div>
          <h3>A little learning, on the go</h3>
          <p>Find AI4Kids on your favourite device.</p>
          <div className="kids-app-badges">
            <a
              href="https://apps.apple.com/app/ai4kids/id6780267161"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/badges/app-store.svg"
                alt="Download AI4Kids on the App Store"
                width={120}
                height={40}
              />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=sg.com.tertiarycourses.ai4kids"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/badges/google-play-trimmed.png"
                alt="Get AI4Kids on Google Play"
                width={135}
                height={40}
              />
            </a>
          </div>
        </div>
      </div>
      <div className="kids-wrap kids-footer-bottom">
        <p>
          © {new Date().getFullYear()} AI Kids Academy · Powered by{" "}
          <a
            href="https://www.tertiarycourses.com.sg/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tertiary Infotech Academy Pte Ltd
          </a>
        </p>
        <div>
          <MarketingMotion />
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <span aria-hidden="true">Stay curious. Stay sunny. ☀</span>
        </div>
      </div>
    </footer>
  );
}
