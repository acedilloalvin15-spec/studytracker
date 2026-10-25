'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type Option = { value: string; label: string; color?: string }

export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  invalid,
  className,
  ariaLabel,
}: {
  id?: string
  value: string | undefined
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  invalid?: boolean
  className?: string
  ariaLabel?: string
}) {
  return (
    <Select
      items={options}
      value={value ?? null}
      onValueChange={(v) => onChange((v as string | null) ?? '')}
    >
      <SelectTrigger id={id} aria-invalid={invalid} aria-label={ariaLabel} className={cn('h-10 w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.color && (
              <span className="size-2.5 rounded-full" style={{ backgroundColor: o.color }} aria-hidden="true" />
            )}
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
