/** Original vector scenes for the family workshop album, never raster placeholders. */
export function WorkshopArt({ subject }: { subject: string }) {
  return (
    <svg
      className="kids-workshop-art"
      viewBox="0 0 320 200"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M30 158c-18-23-9-68 16-95C80 28 136 19 183 31c50 12 99 27 111 65 15 47-22 76-81 81-67 6-148 14-183-19Z"
        fill="#fff"
        fillOpacity=".5"
      />
      <g className="art-twinkle" fill="#E6A42C">
        <path d="m36 35 4 11 11 4-11 4-4 11-4-11-11-4 11-4 4-11Z" />
        <path d="m279 35 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" />
      </g>
      {subject === "Storytelling" ? (
        <>
          <path
            d="M72 90c30-12 57-6 87 11 26-17 54-23 88-11v75c-34-9-58-3-88 15-29-17-56-22-87-15V90Z"
            fill="#CB95DC"
            stroke="#65418F"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M80 82c27-8 52-4 79 13 28-17 55-21 80-13v73c-28-7-52-2-80 17-26-18-51-23-79-17V82Z"
            fill="#FFFBEA"
            stroke="#8067A0"
            strokeWidth="2.5"
          />
          <path
            d="M159 96v75M95 110l46 12M95 124l39 10M95 138l32 8"
            stroke="#C3ACDA"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <g className="art-bob">
            <path
              d="M174 135c11-17 8-38 16-43 5-4 18-4 22 1 9 10-5 20-1 29 3 8 15 7 15 17h-52Z"
              fill="#9DD8CF"
              stroke="#367B80"
              strokeWidth="2.5"
            />
            <path
              d="m187 117 21-1M188 126l23-1"
              stroke="#367B80"
              strokeWidth="2"
            />
            <circle cx="203" cy="98" r="2.5" fill="#65418F" />
            <path
              d="M198 104h-8"
              stroke="#367B80"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M179 140c6-6 13 6 20 0s14 6 21 0"
              stroke="#4B9EAC"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
          <path
            d="M109 68c8-33 62-33 73 0M119 69c8-24 43-24 53 0M130 69c6-14 25-14 31 0"
            stroke="#EB8DA9"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M119 69c8-24 43-24 53 0"
            stroke="#F5C44C"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="m259 119-12 30 3 10 9-6 12-30-12-4Z"
            fill="#F7C95A"
            stroke="#986B35"
            strokeWidth="2"
          />
          <path d="m250 154-2 5 5-3" fill="#65418F" />
        </>
      ) : subject === "Art & creativity" ? (
        <>
          <path
            d="m90 47 151 7-5 112-151-7 5-112Z"
            fill="#FFFDF3"
            stroke="#7971AA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="m103 62 123 5-3 85-124-5 4-85Z" fill="#DFF0FF" />
          <path
            d="m112 137 30-35 19 21 23-29 32 45"
            fill="#9BD4AD"
            stroke="#4B9B77"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="195" cy="86" r="15" fill="#FFD55D" />
          <path d="M131 93c-16-12-25 8 1 22 27-13 18-35-1-22Z" fill="#EF92B0" />
          <g className="art-bob">
            <path
              d="M41 111c7-27 44-27 51-1 9 30-8 47-26 42-17-4-29-21-25-41Z"
              fill="#F3C55E"
              stroke="#AA763B"
              strokeWidth="2.5"
            />
            <circle cx="54" cy="113" r="6" fill="#EB79A5" />
            <circle cx="68" cy="103" r="6" fill="#85BCCC" />
            <circle cx="82" cy="116" r="6" fill="#A08DD7" />
            <circle cx="72" cy="136" r="6" fill="#FFF8E7" />
          </g>
          <path
            d="m255 65 7 2-17 68-8-3 18-67Z"
            fill="#8D7AC0"
            stroke="#5F528F"
            strokeWidth="2"
          />
          <path
            d="M236 133c-11 3-10 14-17 19 18 0 27-5 25-16l-8-3Z"
            fill="#EC92AD"
            stroke="#A25583"
            strokeWidth="2"
          />
        </>
      ) : subject === "Maths" ? (
        <>
          <path
            d="m83 45 128-5 5 121-128 7-5-123Z"
            fill="#FFFCED"
            stroke="#588B80"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <g stroke="#B7D9D4" strokeWidth="1">
            <path d="M98 62h98M98 82h98M98 102h98M98 122h98M98 142h98M112 54v99M132 54v99M152 54v99M172 54v99M192 54v99" />
          </g>
          <g
            fill="#7F70BA"
            fontFamily="var(--font-fun), sans-serif"
            fontSize="32"
            fontWeight="600"
          >
            <text x="112" y="94">
              3 + 4
            </text>
            <text x="127" y="131">
              = 7
            </text>
          </g>
          <g className="art-bob" transform="rotate(18 225 119)">
            <circle
              cx="223"
              cy="100"
              r="34"
              fill="#D9F1FF"
              fillOpacity=".8"
              stroke="#6D67A9"
              strokeWidth="7"
            />
            <path
              d="M223 135v35"
              stroke="#6D67A9"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M205 84c4-7 12-9 20-9"
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>
          <circle cx="62" cy="113" r="14" fill="#F5CA61" />
          <path
            d="m55 113 5 5 9-11"
            stroke="#A67434"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path
            d="M165 79v65"
            stroke="#488C6A"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M164 104c-29 5-45-10-44-28 28-4 47 10 44 28Z"
            fill="#9CCB81"
            stroke="#488C6A"
            strokeWidth="2.5"
          />
          <path
            d="M166 88c28 2 41-16 37-33-28-1-41 13-37 33Z"
            fill="#B8DFA2"
            stroke="#488C6A"
            strokeWidth="2.5"
          />
          <path
            d="m132 130 66 1-9 40h-47l-10-41Z"
            fill="#F0B6C9"
            stroke="#A66895"
            strokeWidth="2.5"
          />
          <path d="M133 133h63" stroke="#A66895" strokeWidth="4" />
          <g className="art-bob">
            <path
              d="M52 75h52v57c20 27 15 36-26 36-36 0-42-11-25-36V75Z"
              fill="#DFF1FD"
              stroke="#6D7CAB"
              strokeWidth="3"
            />
            <path
              d="M54 132c13 10 28-10 47 0l13 23c-21 10-52 8-73 0l13-23Z"
              fill="#A4DCD6"
            />
            <circle cx="69" cy="139" r="4" fill="#FFF" />
            <circle cx="85" cy="150" r="6" fill="#FFF" />
            <circle cx="85" cy="111" r="4" fill="#A4DCD6" />
          </g>
          <rect
            x="220"
            y="94"
            width="59"
            height="61"
            rx="15"
            fill="#E6D5FA"
            stroke="#8C6DB6"
            strokeWidth="2.5"
          />
          <path d="M238 92V81h23v11" stroke="#8C6DB6" strokeWidth="3" />
          <circle cx="238" cy="118" r="4" fill="#7B5D9E" />
          <circle cx="261" cy="118" r="4" fill="#7B5D9E" />
          <path
            d="M241 133c4 6 12 6 17 0"
            stroke="#7B5D9E"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="m220 148-10 9m69-10 10 8"
            stroke="#8C6DB6"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export function ToyboxArt() {
  return (
    <svg
      className="kids-toybox-art"
      viewBox="0 0 320 260"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M30 190c-30-75 17-138 93-145s154 18 170 84c21 91-53 121-145 114-60-4-99-5-118-53Z"
        fill="#E5DBFA"
      />
      <path
        d="m65 114 10-67 22 4-10 68"
        fill="#F6CB5B"
        stroke="#9B773C"
        strokeWidth="3"
      />
      <path
        d="m77 47 13-20 7 24"
        fill="#FFF6D6"
        stroke="#9B773C"
        strokeWidth="2"
      />
      <path
        d="m204 120 23-74 20 7-22 75"
        fill="#E99AB8"
        stroke="#AA668E"
        strokeWidth="3"
      />
      <path
        d="m228 45 4-20 15 27"
        fill="#FCE9EC"
        stroke="#AA668E"
        strokeWidth="2"
      />
      <path
        d="M117 105V66c0-15 59-15 59 0v39"
        stroke="#6E78AC"
        strokeWidth="12"
      />
      <path
        d="M49 110c71-14 149-13 225 0l-12 109c-68 12-133 13-200 0L49 110Z"
        fill="#A6DCD2"
        stroke="#4F888A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M45 106c69-12 153-13 232 0v28c-76-11-157-12-232 0v-28Z"
        fill="#C2EADD"
        stroke="#4F888A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect
        x="143"
        y="123"
        width="34"
        height="27"
        rx="7"
        fill="#FFE28A"
        stroke="#A18B4C"
        strokeWidth="3"
      />
      <ellipse cx="122" cy="170" rx="5" ry="7" fill="#68609C" />
      <ellipse cx="195" cy="170" rx="5" ry="7" fill="#68609C" />
      <ellipse cx="105" cy="186" rx="11" ry="6" fill="#EBA2BB" />
      <ellipse cx="211" cy="186" rx="11" ry="6" fill="#EBA2BB" />
      <path
        d="M145 184c9 12 20 12 30 0"
        stroke="#68609C"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g className="art-twinkle" fill="#D9AB3E">
        <path d="m35 59 4 11 11 4-11 4-4 11-4-11-11-4 11-4 4-11Z" />
        <path d="m280 47 4 11 11 4-11 4-4 11-4-11-11-4 11-4 4-11Z" />
      </g>
    </svg>
  );
}
