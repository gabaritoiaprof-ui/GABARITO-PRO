import React from "react";

interface LogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  variant?: "light" | "dark" | "gradient";
}

export default function Logo({ className = "", size = "md", variant = "gradient" }: LogoProps) {
  // Determine dimensions based on size prop
  let width = 200;
  let height = 200;

  if (typeof size === "number") {
    width = size;
    height = size;
  } else {
    switch (size) {
      case "xs":
        width = 32;
        height = 32;
        break;
      case "sm":
        width = 48;
        height = 48;
        break;
      case "md":
        width = 96;
        height = 96;
        break;
      case "lg":
        width = 144;
        height = 144;
        break;
      case "xl":
        width = 256;
        height = 256;
        break;
    }
  }

  // Set colors based on variant
  const stopColor1 = variant === "light" ? "#FFFFFF" : "#0A2540";
  const stopColor2 = variant === "light" ? "#F1F5F9" : "#1D4ED8";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} transition-all duration-300`}
    >
      <defs>
        {variant === "gradient" ? (
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B2B5C" />
            <stop offset="50%" stopColor="#081E3D" />
            <stop offset="100%" stopColor="#1B497E" />
          </linearGradient>
        ) : (
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stopColor1} />
            <stop offset="100%" stopColor={stopColor2} />
          </linearGradient>
        )}

        {/* Mask to cut the slit and the breather hole out of the pen nib */}
        <mask id="nibMask">
          <rect x="0" y="0" width="1000" height="1000" fill="white" />
          {/* Breather hole */}
          <circle cx="500" cy="560" r="24" fill="black" />
          {/* Vertical slit */}
          <rect x="494" y="560" width="12" height="210" rx="3" fill="black" />
        </mask>
      </defs>

      {/* Main Logo Group */}
      <g fill="url(#logoGrad)">
        {/* 1. Graduation Cap (Diamond mortarboard at the top) */}
        <path d="M 500 160 L 800 320 L 500 480 L 200 320 Z" />

        {/* 2. Tassel (Pingente) */}
        {/* Cord */}
        <path d="M 760 300 L 760 410" stroke="url(#logoGrad)" strokeWidth="8" strokeLinecap="round" opacity="0.95" />
        {/* Tassel bead */}
        <circle cx="760" cy="415" r="14" />
        {/* Tassel brush */}
        <path d="M 746 425 L 774 425 L 784 500 L 736 500 Z" />

        {/* 3. Pen Nib (with mask applied for the central circle and slit) */}
        <path 
          d="M 390 390 
             L 390 540 
             C 390 580, 370 610, 320 630 
             C 320 670, 320 710, 500 770 
             C 680 710, 680 670, 680 630 
             C 630 610, 610 580, 610 540 
             L 610 390 
             Z" 
          mask="url(#nibMask)" 
        />

        {/* 4. Open Book Pages (Symmetrical curved wings below the pen nib) */}
        {/* Left top page */}
        <path d="M 480 740 C 370 680, 240 540, 130 510 C 190 560, 360 710, 480 730 Z" />
        {/* Left bottom page */}
        <path d="M 480 780 C 370 720, 220 600, 110 570 C 170 620, 360 750, 480 770 Z" />

        {/* Right top page */}
        <path d="M 520 740 C 630 680, 760 540, 870 510 C 810 560, 640 710, 520 730 Z" />
        {/* Right bottom page */}
        <path d="M 520 780 C 630 720, 780 600, 890 570 C 830 620, 640 750, 520 770 Z" />
      </g>
    </svg>
  );
}
