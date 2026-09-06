import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-amber-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-fun text-lg font-700 text-slate-800">
            <span aria-hidden>🤖</span> AI <span className="text-coral">Kids</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Where children ages 4–16 learn AI by making things they love.
          </p>
          <h4 className="mt-6 font-fun font-700 text-slate-700">Get the app</h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href="https://apps.apple.com/app/ai4kids/id6780267161"
              target="_blank"
              rel="noopener noreferrer"
              title="Download AI4Kids on the App Store"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/badges/app-store.svg"
                alt="Download AI4Kids on the App Store"
                className="h-9 w-auto"
              />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=sg.com.tertiarycourses.ai4kids"
              target="_blank"
              rel="noopener noreferrer"
              title="Get AI4Kids on Google Play"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {/* Google's badge ships with ~12% transparent padding; the negative
                  margin trims it so it optically matches the App Store badge. */}
              <img
                src="/badges/google-play.png"
                alt="Get AI4Kids on Google Play"
                className="-my-1.5 -mx-2 h-12 w-auto"
              />
            </a>
          </div>
        </div>
        <div>
          <h4 className="font-fun font-700 text-slate-700">Learn</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            <li><Link href="/programs" className="hover:text-coral">All programs</Link></li>
            <li><Link href="/#ages" className="hover:text-coral">By age group</Link></li>
            <li><Link href="/login" className="hover:text-coral">Kid login</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-fun font-700 text-slate-700">Parents</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            <li><Link href="/parent" className="hover:text-coral">Parent dashboard</Link></li>
            <li><Link href="/contact" className="hover:text-coral">Contact us</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-fun font-700 text-slate-700">Legal</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            <li><Link href="/privacy" className="hover:text-coral">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-coral">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-amber-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} AI Kids Academy. Made with curiosity & code.
        <span className="mx-1">·</span>
        Powered by{" "}
        <a
          href="https://www.tertiarycourses.com.sg/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-600 text-slate-500 underline hover:text-coral"
        >
          Tertiary Infotech Academy Pte Ltd
        </a>
      </div>
    </footer>
  );
}
