import type { SVGProps } from "react";

export type KidsIconName =
  | "book"
  | "maths"
  | "art"
  | "science"
  | "bag"
  | "wand"
  | "gift"
  | "home"
  | "mail"
  | "heart"
  | "sparkles"
  | "shield"
  | "sun"
  | "arrow"
  | "download"
  | "check"
  | "close"
  | "menu"
  | "send"
  | "chat"
  | "play"
  | "pause"
  | "left"
  | "right"
  | "pin"
  | "phone"
  | "rainbow";
type Props = SVGProps<SVGSVGElement> & { name: KidsIconName };

/** Original AI Kids doodles. These shapes and characters are drawn for this site. */
export function KidsIcon({ name, className = "", ...props }: Props) {
  const ink = "#755299";
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`kids-icon ${className}`}
      aria-hidden="true"
      {...props}
    >
      {name === "book" ? (
        <>
          <path
            d="M5 12c8-3 14-2 19 3 6-5 12-6 20-3v28c-8-2-14-1-20 3-6-4-12-5-20-3l1-28Z"
            fill="#D8BEF0"
            stroke={ink}
            strokeWidth="2"
          />
          <path
            d="M8 10c6-2 11-1 16 3 5-4 10-5 16-3v25c-6-2-11 0-16 4-5-4-10-6-16-4V10Z"
            fill="#FFF6CF"
            stroke={ink}
            strokeWidth="1.7"
          />
          <path
            d="M24 14v23M12 20l7 2M12 26l7 2"
            stroke="#B59BCA"
            strokeWidth="1.7"
          />
          <circle cx="29" cy="23" r="1.6" fill={ink} />
          <circle cx="36" cy="23" r="1.6" fill={ink} />
          <path d="M29 28c2 3 5 3 7 0" stroke={ink} strokeWidth="1.7" />
          <path
            d="m33 2 2 4 5 .7-3.5 3.5.8 4.8-4.3-2.3-4.3 2.3.8-4.8L26 6.7l5-.7 2-4Z"
            fill="#F4CD67"
          />
        </>
      ) : name === "maths" ? (
        <>
          <circle
            cx="21"
            cy="20"
            r="14"
            fill="#C8EBE7"
            stroke={ink}
            strokeWidth="2.5"
          />
          <path d="m31 31 9 10" stroke={ink} strokeWidth="7" />
          <path d="m31 31 9 10" stroke="#AA8DD0" strokeWidth="4" />
          <circle cx="16" cy="19" r="1.7" fill={ink} />
          <circle cx="25" cy="19" r="1.7" fill={ink} />
          <path d="M17 24c2 3 5 3 7 0" stroke={ink} strokeWidth="1.8" />
          <path d="M11 11c4-6 12-7 18-2" stroke="#fff" strokeWidth="2.5" />
          <path
            d="M2 35h12v10H2V35Z"
            fill="#FFDB78"
            stroke="#AA7C42"
            strokeWidth="1.5"
          />
          <path d="M8 37v6M5 40h6" stroke="#AA7C42" strokeWidth="1.5" />
        </>
      ) : name === "art" ? (
        <>
          <path
            d="M7 14c9-15 34-10 36 6 1 8-8 8-12 11-5 5 5 10-5 12C9 46-2 29 7 14Z"
            fill="#FFE099"
            stroke="#AF8646"
            strokeWidth="2"
          />
          <circle cx="13" cy="18" r="4" fill="#E494C3" />
          <circle cx="24" cy="12" r="4" fill="#9D8AD6" />
          <circle cx="34" cy="18" r="4" fill="#88CEC3" />
          <circle cx="16" cy="31" r="1.8" fill={ink} />
          <circle cx="24" cy="31" r="1.8" fill={ink} />
          <path d="M17 36c2 2 4 2 6 0" stroke={ink} strokeWidth="1.5" />
          <path
            d="m36 29 4 2-5 12-5 1 1-5 5-10Z"
            fill="#AA8CCB"
            stroke={ink}
            strokeWidth="1.5"
          />
        </>
      ) : name === "science" ? (
        <>
          <path
            d="M15 7h18M18 8v16L9 39c-2 4 27 4 30 0L30 24V8"
            fill="#E5D7F8"
            stroke={ink}
            strokeWidth="2"
          />
          <path
            d="M15 31c6 4 12-3 19 0l4 8c-10 4-20 3-28 0l5-8Z"
            fill="#9AD6C5"
          />
          <circle cx="20" cy="33" r="1.5" fill={ink} />
          <circle cx="29" cy="33" r="1.5" fill={ink} />
          <path d="M21 37c2 2 4 2 6 0" stroke={ink} strokeWidth="1.3" />
          <path
            d="M25 21V10c-9 0-10-7-9-9 8-1 10 4 9 9 0-8 7-10 12-7 0 7-5 9-12 7"
            fill="#B3DA99"
            stroke="#518F72"
            strokeWidth="1.5"
          />
        </>
      ) : name === "bag" ? (
        <>
          <path d="M16 10c0-9 16-9 16 0" stroke={ink} strokeWidth="3" />
          <path
            d="M10 14c0-11 29-11 29 0l3 26c-6 6-29 5-34 0l2-26Z"
            fill="#E2C9EE"
            stroke={ink}
            strokeWidth="2"
          />
          <path
            d="M16 26h17v13H16V26Z"
            fill="#FFF0B1"
            stroke={ink}
            strokeWidth="1.7"
          />
          <path d="M17 16h15" stroke={ink} strokeWidth="2" />
          <circle cx="21" cy="30" r="1.3" fill={ink} />
          <circle cx="28" cy="30" r="1.3" fill={ink} />
          <path d="M22 34c2 2 3 2 5 0" stroke={ink} strokeWidth="1.4" />
        </>
      ) : name === "wand" || name === "sparkles" ? (
        <>
          <path d="m13 35 15-15" stroke={ink} strokeWidth="7" />
          <path d="m13 35 15-15" stroke="#A8DCD3" strokeWidth="4" />
          <path
            d="m31 5 3 7 8 1-6 6 1 8-7-4-7 4 1-8-6-6 9-1 4-7Z"
            fill="#FFDA77"
            stroke="#B18B45"
            strokeWidth="1.6"
          />
          <path
            d="m10 6 1.5 4.5L16 12l-4.5 1.5L10 18l-1.5-4.5L4 12l4.5-1.5L10 6ZM36 32l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"
            fill="#D29CCC"
          />
        </>
      ) : name === "gift" ? (
        <>
          <path
            d="M8 20h32v23H8V20Z"
            fill="#B7DFD4"
            stroke="#4C8C7D"
            strokeWidth="2"
          />
          <path
            d="M5 15h38v10H5V15Z"
            fill="#D1B8E9"
            stroke={ink}
            strokeWidth="2"
          />
          <path d="M24 15v28" stroke="#FFE09C" strokeWidth="6" />
          <path
            d="M23 15C4 16 9-4 21 6l3 7c7-23 27-9 2 2"
            fill="#F7C1D6"
            stroke="#B575A4"
            strokeWidth="2"
          />
          <circle cx="17" cy="31" r="1.5" fill={ink} />
          <circle cx="32" cy="31" r="1.5" fill={ink} />
          <path d="M19 36c3 3 7 3 10 0" stroke={ink} strokeWidth="1.5" />
        </>
      ) : name === "home" ? (
        <>
          <path d="m4 23 20-18 20 18" stroke={ink} strokeWidth="3" />
          <path
            d="M9 21v22h30V21L24 9 9 21Z"
            fill="#D6EED9"
            stroke="#5E9882"
            strokeWidth="2"
          />
          <path
            d="M21 43V29h10v14"
            fill="#D6BFEC"
            stroke={ink}
            strokeWidth="1.7"
          />
          <path d="M13 24h6v7h-6v-7Z" fill="#FFE6A6" />
          <path
            d="m31 7 1.5-4 2 4 4 1-3 3 .5 4-3.5-2-3 2 .5-4-3-3 4-1Z"
            fill="#F5C965"
          />
        </>
      ) : name === "mail" ? (
        <>
          <path
            d="m5 14 37-1 1 27-38 1V14Z"
            fill="#E2CEF1"
            stroke={ink}
            strokeWidth="2"
          />
          <path
            d="m6 15 18 15 17-16M6 39l13-13m22 12L29 26"
            stroke={ink}
            strokeWidth="1.8"
          />
          <path
            d="M24 8c-9-10-15 4 0 12 16-9 9-22 0-12Z"
            fill="#EBABC9"
            stroke="#B96D9B"
            strokeWidth="1.5"
          />
        </>
      ) : name === "heart" ? (
        <>
          <path
            d="M24 12C9-6-6 21 24 43 55 21 39-6 24 12Z"
            fill="#F3C1D9"
            stroke="#B774A8"
            strokeWidth="2"
          />
          <circle cx="17" cy="24" r="1.7" fill={ink} />
          <circle cx="30" cy="24" r="1.7" fill={ink} />
          <path d="M20 30c3 3 6 3 9 0" stroke={ink} strokeWidth="1.6" />
        </>
      ) : name === "shield" ? (
        <>
          <path
            d="m24 4 17 7-2 19c-2 8-8 12-15 15-8-4-14-8-16-16L6 11l18-7Z"
            fill="#C8E8DE"
            stroke="#538F82"
            strokeWidth="2"
          />
          <path d="m14 24 7 7 13-15" stroke={ink} strokeWidth="4" />
          <path d="m24 7 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" fill="#FFE7A3" />
        </>
      ) : name === "sun" ? (
        <>
          <g stroke="#DFAC40" strokeWidth="2.5">
            <path d="M24 2v5M24 41v5M2 24h5M41 24h5M8 8l4 4m24 24 4 4M8 40l4-4M36 12l4-4" />
          </g>
          <circle
            cx="24"
            cy="24"
            r="15"
            fill="#FFDF7A"
            stroke="#BB8A40"
            strokeWidth="1.7"
          />
          <circle cx="19" cy="22" r="1.8" fill={ink} />
          <circle cx="29" cy="22" r="1.8" fill={ink} />
          <ellipse cx="15" cy="27" rx="3" ry="2" fill="#F2A5BB" />
          <ellipse cx="33" cy="27" rx="3" ry="2" fill="#F2A5BB" />
          <path d="M20 28c3 4 6 4 9 0" stroke={ink} strokeWidth="1.7" />
        </>
      ) : name === "rainbow" ? (
        <>
          <path d="M4 37C4 3 44 3 44 37" stroke="#E8A0C5" strokeWidth="6" />
          <path d="M10 37c0-25 28-25 28 0" stroke="#F6D373" strokeWidth="6" />
          <path d="M16 37c0-15 16-15 16 0" stroke="#ABDCD1" strokeWidth="6" />
        </>
      ) : name === "chat" ? (
        <>
          <path
            d="M7 35C-4 13 11 3 25 5c18-2 27 21 13 32-6 5-17 5-23 1L5 43l2-8Z"
            fill="#C8E7D9"
            stroke="#478D77"
            strokeWidth="2"
          />
          <path
            d="m16 14-3 5c2 9 8 15 17 16l5-5-6-5-4 3c-3-1-5-3-6-6l3-3-6-5Z"
            fill="#fff"
            stroke="#478D77"
            strokeWidth="1.5"
          />
        </>
      ) : name === "download" ? (
        <>
          <path
            d="M11 28c-14-4-7-19 3-17 4-15 25-10 24 2 15-1 14 17 1 17"
            fill="#D4EAF5"
            stroke="#6A86AF"
            strokeWidth="2"
          />
          <path
            d="M24 16v23m-8-8 8 8 8-8M9 43h30"
            stroke="currentColor"
            strokeWidth="3"
          />
        </>
      ) : name === "check" ? (
        <>
          <path
            d="M42 23c2 22-35 29-38 5C0 6 36-5 42 18"
            fill="#D7EBDD"
            stroke="#629B80"
            strokeWidth="2"
          />
          <path d="m12 24 9 9 17-19" stroke={ink} strokeWidth="3" />
        </>
      ) : name === "arrow" || name === "right" || name === "left" ? (
        <g
          transform={
            name === "left" ? "translate(48 0) scale(-1 1)" : undefined
          }
        >
          <path
            d="M6 25c10-3 21-3 35-1M28 12c4 5 9 9 14 12-6 3-11 8-15 13"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          <path d="m9 13 1 3 4 1-4 1-1 3-1-3-3-1 3-1 1-3Z" fill="#E6B6D9" />
        </g>
      ) : name === "send" ? (
        <>
          <path
            d="M3 22 44 5 31 43 20 29 3 22Z"
            fill="#D0B8EA"
            stroke={ink}
            strokeWidth="2"
          />
          <path
            d="M20 29 43 6 25 32l-7 8 2-11Z"
            fill="#FFF0AF"
            stroke={ink}
            strokeWidth="1.6"
          />
        </>
      ) : name === "menu" ? (
        <>
          <path
            d="M7 12c11-3 23 3 34 0M7 24c12-3 22 3 34 0M7 36c11-3 23 3 34 0"
            stroke={ink}
            strokeWidth="4"
          />
          <path d="M7 12h4M7 24h4M7 36h4" stroke="#E9A2C6" strokeWidth="4" />
        </>
      ) : name === "close" ? (
        <path
          d="M12 11c6 10 14 17 25 26M11 37c11-6 18-16 25-26"
          stroke="currentColor"
          strokeWidth="4"
        />
      ) : name === "pause" ? (
        <>
          <path
            d="m15 9-1 30M33 9l1 30"
            stroke="currentColor"
            strokeWidth="7"
          />
        </>
      ) : name === "play" ? (
        <path
          d="m15 7 25 17-25 17V7Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2"
        />
      ) : name === "pin" ? (
        <>
          <path
            d="M24 44C-4 18 11 3 24 4c16-1 25 17 0 40Z"
            fill="#E2C9EE"
            stroke={ink}
            strokeWidth="2"
          />
          <circle
            cx="24"
            cy="20"
            r="7"
            fill="#FFF1B2"
            stroke={ink}
            strokeWidth="1.5"
          />
        </>
      ) : name === "phone" ? (
        <path
          d="m14 5-8 5c-3 16 15 35 31 32l6-8-11-8-6 6c-5-3-9-7-11-12l6-6-7-9Z"
          fill="#BDE3D4"
          stroke="#508B7D"
          strokeWidth="2"
        />
      ) : null}
    </svg>
  );
}
