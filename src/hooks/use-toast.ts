"use client"

import type { ReactNode } from "react"
import { toast as sonnerToast, type ExternalToast } from "sonner"

type ToastOptions = Omit<ExternalToast, "id"> & {
  title?: ReactNode
  variant?: "default" | "destructive"
}

function showToast({ title, variant = "default", ...options }: ToastOptions) {
  const notify = variant === "destructive" ? sonnerToast.error : sonnerToast
  const id = notify(title, options)

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: (next: ToastOptions) => {
      const { title: nextTitle, variant: nextVariant = variant, ...nextOptions } = next
      const updateToast = nextVariant === "destructive" ? sonnerToast.error : sonnerToast
      updateToast(nextTitle, { ...nextOptions, id })
    },
  }
}

function useToast() {
  return {
    toast: showToast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  }
}

export { useToast, showToast as toast }
