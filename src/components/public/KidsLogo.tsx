import Link from "next/link";

/** Original sunny bookworm mark, drawn to stay crisp at every header size. */
export function KidsLogo() {
  return (
    <Link href="/" className="kids-logo" aria-label="AI Kids Academy home">
      <svg
        className="kids-logo-character"
        viewBox="0 0 116 116"
        fill="none"
        aria-hidden="true"
      >
        <g stroke="#EBAB38" strokeWidth="5" strokeLinecap="round">
          <path d="M57 5v7M25 13l4 6M8 37l7 3M91 15l-4 6M106 39l-7 3" />
        </g>
        <path
          d="M93 53c0 21-16 39-37 39S18 75 18 53s16-37 38-37 37 16 37 37Z"
          fill="#FFDC69"
          stroke="#B77B28"
          strokeWidth="2.5"
        />
        <ellipse cx="42" cy="48" rx="4" ry="5.5" fill="#624282" />
        <ellipse cx="70" cy="48" rx="4" ry="5.5" fill="#624282" />
        <circle cx="43" cy="46" r="1.3" fill="white" />
        <circle cx="71" cy="46" r="1.3" fill="white" />
        <ellipse cx="31" cy="60" rx="8" ry="5" fill="#F89B9D" />
        <ellipse cx="81" cy="60" rx="8" ry="5" fill="#F89B9D" />
        <path d="M44 61c3 13 20 13 24 0H44Z" fill="#AB4C6D" />
        <path
          d="M50 69c4-3 9-3 12 0"
          stroke="#FFBBBE"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="m12 76 44 10 45-10v29l-45 8-44-8V76Z"
          fill="#70B9AD"
          stroke="#327A78"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M16 74c14-4 28-1 40 8 13-9 27-12 41-8v26c-15-4-27-1-41 8-12-9-25-12-40-8V74Z"
          fill="#FFF9E6"
          stroke="#B78865"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M56 83v23M24 83l22 7M24 91l18 5"
          stroke="#E8B278"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m77 81 2.7 5.5 6.3.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.5-4.4 6.3-.9L77 81Z"
          fill="#E88D91"
        />
        <path
          d="M14 82c-11-6-15 5-4 10l9 2M101 83c10-7 15 5 4 10l-7 2"
          fill="#FFDC69"
          stroke="#B77B28"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path d="m101 55 3-7 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#CE92CA" />
      </svg>
      <span className="kids-logo-lettering" aria-hidden="true">
        <span className="kids-logo-word">
          <span>A</span>
          <span>I</span>
          <span className="kids-logo-word-gap">K</span>
          <span>i</span>
          <span>d</span>
          <span>s</span>
          <span className="kids-logo-heart">♥</span>
        </span>
      </span>
    </Link>
  );
}
