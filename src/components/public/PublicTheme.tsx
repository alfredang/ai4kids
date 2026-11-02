"use client";
import { usePathname } from "next/navigation";
/** Public family surfaces share one theme; staff tools keep their working chrome. */
export function PublicTheme({children}:{children:React.ReactNode}) {
 const path=usePathname();
 if(path.startsWith('/admin')) return <>{children}</>;
 return <div className={`kids-public-shell ${/^\/(blog|privacy|terms)(\/|$)/.test(path)?'kids-legacy-page':''}`}>{children}</div>;
}
