import type { SVGProps } from "react";

export interface GomuStackLogoProps extends SVGProps<SVGSVGElement> {
  color?: string;
  bgColor?: string;
}

export function GomuStackLogo({ color = "currentColor", bgColor = "var(--background, #ffffff)", ...props }: GomuStackLogoProps) {
  return (
    <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" aria-label="GomuStack Logo" role="img" {...props}>
      <title>GomuStack Logo</title>
      {/* Wires passing data from the Brain to nodes horizontally */}
      <path d="M 100 128 C 132 128 132 60 164 60" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M 100 128 L 164 128" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M 100 128 C 132 128 132 196 164 196" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />

      {/* The Brain Trigger Node (AI Input) */}
      <rect x="28" y="104" width="72" height="48" rx="8" fill="none" stroke={color} strokeWidth="3" />
      <path d="M 28 112 Q 28 104 36 104 H 60 V 152 H 36 Q 28 152 28 144 Z" fill={color} />
      <path d="M 44 116 C 44 128 44 128 56 128 C 44 128 44 128 44 140 C 44 128 44 128 32 128 C 44 128 44 128 44 116 Z" fill={bgColor} />
      <line x1="68" y1="120" x2="88" y2="120" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <line x1="68" y1="136" x2="80" y2="136" stroke={color} strokeWidth="3" strokeLinecap="round" />

      {/* Supportive N8n Tools Node (Top) */}
      <rect x="164" y="44" width="64" height="32" rx="6" fill="none" stroke={color} strokeWidth="3" />
      <path d="M 164 50 Q 164 44 170 44 H 188 V 76 H 170 Q 164 76 164 70 Z" fill={color} />
      <path d="M 176 54 C 176 60 176 60 182 60 C 176 60 176 60 176 66 C 176 60 176 60 170 60 C 176 60 176 60 176 54 Z" fill={bgColor} />
      <line x1="196" y1="60" x2="220" y2="60" stroke={color} strokeWidth="2" strokeLinecap="round" />

      {/* Supportive N8n Tools Node (Middle) */}
      <rect x="164" y="112" width="64" height="32" rx="6" fill="none" stroke={color} strokeWidth="3" />
      <path d="M 164 118 Q 164 112 170 112 H 188 V 144 H 170 Q 164 144 164 138 Z" fill={color} />
      <path d="M 176 122 C 176 128 176 128 182 128 C 176 128 176 128 176 134 C 176 128 176 128 170 128 C 176 128 176 128 176 122 Z" fill={bgColor} />
      <line x1="196" y1="128" x2="220" y2="128" stroke={color} strokeWidth="2" strokeLinecap="round" />

      {/* Supportive N8n Tools Node (Bottom) */}
      <rect x="164" y="180" width="64" height="32" rx="6" fill="none" stroke={color} strokeWidth="3" />
      <path d="M 164 186 Q 164 180 170 180 H 188 V 212 H 170 Q 164 212 164 206 Z" fill={color} />
      <path d="M 176 190 C 176 196 176 196 182 196 C 176 196 176 196 176 202 C 176 196 176 196 170 196 C 176 196 176 196 176 190 Z" fill={bgColor} />
      <line x1="196" y1="196" x2="220" y2="196" stroke={color} strokeWidth="2" strokeLinecap="round" />

      {/* N8n Hardware Ports */}
      <circle cx="100" cy="128" r="4" fill={bgColor} stroke={color} strokeWidth="3" />
      <circle cx="164" cy="60" r="3" fill={bgColor} stroke={color} strokeWidth="3" />
      <circle cx="164" cy="128" r="3" fill={bgColor} stroke={color} strokeWidth="3" />
      <circle cx="164" cy="196" r="3" fill={bgColor} stroke={color} strokeWidth="3" />
    </svg>
  );
}
