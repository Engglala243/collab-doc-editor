import { LabelHTMLAttributes } from "react";

export function Label({ className = "", children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`block text-[15px] font-medium text-[#e5e5e5] mb-2 ${className}`} {...props}>
      {children}
    </label>
  );
}
