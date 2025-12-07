import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Loader2 } from "lucide-react";

const spinnerVariants = cva(
  "inline-flex items-center justify-center animate-spin",
  {
    variants: {
      size: {
        default: "h-4 w-4",
        sm: "h-3 w-3",
        lg: "h-6 w-6",
        xl: "h-8 w-8",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {}

const Spinner: React.FC<SpinnerProps> = ({ className, size, ...props }) => (
  <Loader2 className={cn(spinnerVariants({ size }), className)} {...props} />
);

export { Spinner, spinnerVariants };