import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { fieldVariants, type FieldSize } from "@/components/ui/input";

// A textarea shares the field look and grows with its text. Its minimum is a
// few lines, not one, so the box reads as a place to write.
const textareaVariants = cva("field-sizing-content py-3", {
  variants: {
    size: {
      phone: "min-h-24",
      hub: "min-h-20",
    },
  },
});

type TextareaProps = React.ComponentProps<"textarea"> & {
  size?: FieldSize;
};

function Textarea({ className, size = "phone", ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      data-size={size}
      className={cn(fieldVariants({ size }), "h-auto", textareaVariants({ size }), className)}
      {...props}
    />
  );
}

export { Textarea };
export type { TextareaProps };
