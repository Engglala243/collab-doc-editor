import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-[#e60000] hover:bg-[#cc0000] text-white rounded-xl px-4 py-2.5",
    secondary: "bg-[#262626] hover:bg-[#333333] border border-[#404040]/50 text-[#e5e5e5] rounded-xl px-4 py-2.5",
    ghost: "hover:bg-[#262626] text-[#a1a1aa] hover:text-white rounded-lg p-2",
    danger: "bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2.5",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
