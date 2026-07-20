import { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-4 py-3 bg-[#262626] border border-[#404040]/50 rounded-xl text-white placeholder-[#737373] focus:outline-none focus:border-[#e60000] transition-colors ${className}`}
      {...props}
    />
  );
}
