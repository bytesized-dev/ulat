import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The look every text field shares, so Input, Select and Textarea stay one
// family. DESIGN.md asks for a 2px primary border on focus. The border stays
// 1px and a 1px ring is added outside it, so the field does not shift by a
// pixel when it takes focus.
const fieldVariants = cva(
  "w-full min-w-0 rounded-md border border-hairline bg-canvas text-ink outline-none transition-colors placeholder:text-muted-text focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted-text aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger",
  {
    variants: {
      size: {
        phone: "h-13 px-4 text-body-md",
        hub: "hit h-11 px-4 text-body-sm",
      },
    },
    defaultVariants: {
      size: "phone",
    },
  },
);

type FieldSize = NonNullable<VariantProps<typeof fieldVariants>["size"]>;

type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  size?: FieldSize;
};

function Input({ className, type, size = "phone", ...props }: InputProps) {
  return <input type={type} data-slot="input" data-size={size} className={cn(fieldVariants({ size }), className)} {...props} />;
}

export { Input, fieldVariants };
export type { FieldSize, InputProps };
