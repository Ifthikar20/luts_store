import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/format";

type CommonProps = {
  children: ReactNode;
  className?: string;
  variant?: "grade" | "ghost";
};

/**
 * Primary action button/link. Renders a Link when `href` is provided,
 * otherwise a button.
 *
 * Formerly "magnetic" (it followed the cursor with spring physics) — that
 * wobble made key CTAs like Pay/Add-to-cart feel unstable, so the element is
 * now stationary with only a subtle CSS press feedback. The exported name is
 * kept for call-site compatibility.
 */
const base =
  "relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition-transform active:scale-[0.98]";

const variants = {
  grade:
    "text-white bg-sky shadow-[0_2px_10px_rgba(0,113,227,0.25)] transition-colors hover:bg-sky-hover",
  ghost:
    "text-graphite bg-haze transition-colors hover:bg-[#dcdce2]",
};

type ButtonProps = CommonProps & {
  href?: undefined;
  onClick?: () => void;
  type?: "button" | "submit";
};
type LinkProps = CommonProps & { href: string };

export const MagneticButton = forwardRef<HTMLElement, ButtonProps | LinkProps>(
  function MagneticButton(props, _ref) {
    const { children, className, variant = "grade" } = props;
    const cls = cn(base, variants[variant], className);

    if ("href" in props && props.href) {
      return (
        <Link href={props.href} className={cls}>
          {children}
        </Link>
      );
    }

    const { onClick, type = "button" } = props as ButtonProps;
    return (
      <button type={type} onClick={onClick} className={cls}>
        {children}
      </button>
    );
  },
);
