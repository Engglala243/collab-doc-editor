import { HTMLAttributes } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-[#171717] rounded-3xl p-8 border border-[#262626] shadow-xl ${className}`} {...props}>
      {children}
    </div>
  );
}
