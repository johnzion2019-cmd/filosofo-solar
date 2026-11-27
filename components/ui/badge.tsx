import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "border-transparent bg-primary/15 text-primary",
      outline: "border-border text-muted-foreground",
      warning: "border-amber-300/30 bg-amber-400/15 text-amber-100",
      success: "border-emerald-300/30 bg-emerald-400/15 text-emerald-100",
      info: "border-cyan-300/30 bg-cyan-400/15 text-cyan-100",
      danger: "border-rose-300/30 bg-rose-400/15 text-rose-100",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
