'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const TITLE_SLOT_ID = 'app-header-title'
export const ACTIONS_SLOT_ID = 'app-header-actions'

function useSlot(id: string) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setEl(document.getElementById(id))
  }, [id])
  return el
}

/**
 * Page title, description and action buttons.
 * On desktop they are placed inside the top bar (left: title, right: buttons).
 * On phones the top bar is too small, so they stay at the top of the page.
 */
export function HeaderContent({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  const titleEl = useSlot(TITLE_SLOT_ID)
  const actionsEl = useSlot(ACTIONS_SLOT_ID)

  return (
    <>
      {/* Phones: normal header at the top of the page */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:hidden">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* Desktop: inside the top bar */}
      {titleEl &&
        createPortal(
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
          </div>,
          titleEl,
        )}
      {actionsEl && actions && createPortal(<div className="flex items-center gap-2">{actions}</div>, actionsEl)}
    </>
  )
}
