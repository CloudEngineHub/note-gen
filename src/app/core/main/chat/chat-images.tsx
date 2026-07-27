"use client"
import Image from "next/image"
import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useTranslations } from "next-intl"

interface ChatImagesProps {
  images: string[]
}

export function ChatImages({ images }: ChatImagesProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const t = useTranslations('record.chat.preview')

  if (!images || images.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-2 my-2">
        {images.map((imageUrl, index) => (
          <button
            type="button"
            key={index}
            className="relative cursor-pointer overflow-hidden rounded-lg border transition-colors hover:border-primary"
            style={{ width: '120px', height: '120px' }}
            onClick={() => setSelectedImage(imageUrl)}
          >
            <Image
              src={imageUrl}
              alt={`Image ${index + 1}`}
              fill
              className="object-cover"
              unoptimized
            />
          </button>
        ))}
      </div>

      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogTitle className="sr-only">{t('image')}</DialogTitle>
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <Image
                src={selectedImage}
                alt={t('image')}
                width={1200}
                height={800}
                className="object-contain max-h-[85vh]"
                unoptimized
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
