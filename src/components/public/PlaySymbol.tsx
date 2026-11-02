import { KidsIcon, type KidsIconName } from "./KidsIcon";
const ICONS: Record<string, KidsIconName> = {"🖼️":"art","🎨":"art","📖":"book","📚":"book","🗝️":"bag","🎮":"bag","🧩":"maths","🏆":"sparkles","⭐":"sparkles","🌟":"sparkles","✨":"sparkles","🌻":"sun","☀️":"sun","🔎":"maths","🔍":"maths","🌱":"science","🤖":"science","🏡":"home","👋":"heart","💌":"mail","🎒":"bag","🎁":"gift","💡":"wand","🌈":"rainbow","✅":"check","❌":"close","💚":"heart","❤️":"heart","♥":"heart"};
/** Site-owned visual vocabulary; Unicode is an input identifier, never a stock
 * rendered glyph. Unmapped puzzle symbols get a stable original character. */
export function PlaySymbol({value,className=""}:{value:string;className?:string}) {
 const name=ICONS[value];if(name)return <KidsIcon name={name} className={className}/>;
 const n=[...value].reduce((s,c)=>s+(c.codePointAt(0)??0),0);const colours=['#b7dfd1','#e6bbde','#ffdc82','#accfe9','#c3b9eb'];const colour=colours[n%colours.length];
 return <svg className={`kids-icon kids-puzzle-symbol ${className}`} viewBox="0 0 48 48" aria-hidden="true"><path d={n%2?'M8 17 5 4 19 11Q29 6 34 12L44 5 41 20Q49 45 24 45 0 44 8 17Z':'M9 15Q0 0 15 6L20 12 29 12Q38-2 44 7L39 22Q46 46 23 45 1 45 9 15Z'} fill={colour} stroke="#73558f" strokeWidth="1.7"/><ellipse cx="17" cy="24" rx="2.2" ry="3.2" fill="#73558f"/><ellipse cx="31" cy="24" rx="2.2" ry="3.2" fill="#73558f"/><ellipse cx="12" cy="31" rx="4" ry="2.5" fill="#f2a1b7"/><ellipse cx="36" cy="31" rx="4" ry="2.5" fill="#f2a1b7"/><path d="M19 32q5 6 10 0" fill="none" stroke="#73558f" strokeWidth="1.8"/><path d={`M${15+n%15} 13h4`} stroke="#fff" strokeWidth="3"/></svg>;
}
const SYMBOLS=/(\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)/gu;
export function PlayfulText({text}:{text:string|null|undefined}) {const value=(text??"").replace(/&apos;/g,"'").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">");return <>{value.split(SYMBOLS).map((part,i)=>/\p{Extended_Pictographic}/u.test(part)?<PlaySymbol key={i} value={part}/>:part)}</>;}
