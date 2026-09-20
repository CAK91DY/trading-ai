import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../utils/format'
const variants = cva('ui-button', {
  variants: {
    variant: { default: 'primary', secondary: 'secondary', ghost: 'ghost', destructive: 'danger' },
    size: { default: '', sm: 'small' },
  },
  defaultVariants: { variant: 'secondary', size: 'default' },
})
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  asChild?: boolean
}
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(variants({ variant, size }), className)} {...props} />
}
