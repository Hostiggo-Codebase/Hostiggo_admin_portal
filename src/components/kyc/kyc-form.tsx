'use client'

import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { uploadKYCFile, submitKYC } from '@/lib/services/ticketService'
import type { KYCDocumentType } from '@/types/app'

const DOCUMENT_TYPES: { value: KYCDocumentType; label: string; requiresBack: boolean }[] = [
  { value: 'passport',        label: 'Passport',         requiresBack: false },
  { value: 'driving_license', label: 'Driving Licence',  requiresBack: true  },
  { value: 'national_id',     label: 'National ID Card', requiresBack: true  },
  { value: 'other',           label: 'Other Government ID', requiresBack: false },
]

const ACCEPTED = 'image/jpeg,image/png,image/webp,application/pdf'
const MAX_BYTES = 10 * 1024 * 1024

interface Props {
  onSuccess: () => void
}

type Step = 'type' | 'documents' | 'selfie' | 'review'

interface FilePreview {
  file: File
  previewUrl: string | null
}

function FileInput({
  label,
  id,
  value,
  onChange,
  hint,
}: {
  label: string
  id: string
  value: FilePreview | null
  onChange: (fp: FilePreview) => void
  hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    onChange({ file, previewUrl: preview })
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <input ref={ref} id={id} type="file" accept={ACCEPTED} onChange={handleChange} className="hidden" />
      {value?.previewUrl ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.previewUrl} alt={label} className="w-full max-h-40 object-cover rounded-lg border border-gray-200" />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Change
          </button>
        </div>
      ) : value?.file ? (
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-3">
          <span className="text-gray-400">📄</span>
          <span className="text-sm text-gray-700 truncate">{value.file.name}</span>
          <button type="button" onClick={() => ref.current?.click()} className="ml-auto text-xs text-gray-500 underline">Change</button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-500 transition-colors"
        >
          <span className="text-sm text-gray-500">Click to upload</span>
        </label>
      )}
    </div>
  )
}

export function KYCForm({ onSuccess }: Props) {
  const [step, setStep] = useState<Step>('type')
  const [docType, setDocType] = useState<KYCDocumentType>('passport')
  const [front, setFront] = useState<FilePreview | null>(null)
  const [back, setBack] = useState<FilePreview | null>(null)
  const [selfie, setSelfie] = useState<FilePreview | null>(null)
  const [sizeError, setSizeError] = useState<string | null>(null)

  const requiresBack = DOCUMENT_TYPES.find(d => d.value === docType)?.requiresBack ?? false

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      for (const fp of [front, back, selfie].filter(Boolean) as FilePreview[]) {
        if (fp.file.size > MAX_BYTES) throw new Error(`${fp.file.name} exceeds 10 MB`)
      }

      const frontPath = await uploadKYCFile(user.id, 'front', front!.file)
      const backPath  = back  ? await uploadKYCFile(user.id, 'back',   back.file)   : undefined
      const selfiePath = selfie ? await uploadKYCFile(user.id, 'selfie', selfie.file) : undefined

      await submitKYC({
        documentType:      docType,
        documentFrontPath: frontPath,
        documentBackPath:  backPath,
        selfiePath,
      })
    },
    onSuccess,
  })

  function validateFile(fp: FilePreview) {
    if (fp.file.size > MAX_BYTES) {
      setSizeError(`${fp.file.name} exceeds 10 MB.`)
      return false
    }
    setSizeError(null)
    return true
  }

  // Step: Type selection
  if (step === 'type') {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Select document type</h3>
        <div className="space-y-2">
          {DOCUMENT_TYPES.map(dt => (
            <label key={dt.value} className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:border-gray-400 transition-colors">
              <input
                type="radio"
                name="docType"
                value={dt.value}
                checked={docType === dt.value}
                onChange={() => setDocType(dt.value)}
                className="accent-black"
              />
              <span className="text-sm font-medium">{dt.label}</span>
              {dt.requiresBack && <span className="text-xs text-gray-400 ml-auto">Front + back required</span>}
            </label>
          ))}
        </div>
        <button
          onClick={() => setStep('documents')}
          className="w-full bg-black text-white py-2.5 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          Continue
        </button>
      </div>
    )
  }

  // Step: Document images
  if (step === 'documents') {
    const canContinue = front !== null && (!requiresBack || back !== null)
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Upload your document</h3>
        <FileInput
          label="Front of document"
          id="kyc-front"
          value={front}
          onChange={fp => { if (validateFile(fp)) setFront(fp) }}
          hint="Clear photo or scan — all corners visible"
        />
        {requiresBack && (
          <FileInput
            label="Back of document"
            id="kyc-back"
            value={back}
            onChange={fp => { if (validateFile(fp)) setBack(fp) }}
          />
        )}
        {sizeError && <p className="text-xs text-red-600">{sizeError}</p>}
        <div className="flex gap-3">
          <button onClick={() => setStep('type')} className="flex-1 border border-gray-300 rounded-md py-2.5 text-sm hover:bg-gray-50">Back</button>
          <button
            onClick={() => setStep('selfie')}
            disabled={!canContinue}
            className="flex-1 bg-black text-white py-2.5 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // Step: Selfie (optional)
  if (step === 'selfie') {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Selfie with document <span className="text-gray-400 font-normal">(optional)</span></h3>
        <p className="text-sm text-gray-500">Hold your document next to your face. This helps speed up verification.</p>
        <FileInput
          label="Selfie"
          id="kyc-selfie"
          value={selfie}
          onChange={fp => { if (validateFile(fp)) setSelfie(fp) }}
        />
        {sizeError && <p className="text-xs text-red-600">{sizeError}</p>}
        <div className="flex gap-3">
          <button onClick={() => setStep('documents')} className="flex-1 border border-gray-300 rounded-md py-2.5 text-sm hover:bg-gray-50">Back</button>
          <button
            onClick={() => setStep('review')}
            className="flex-1 bg-black text-white py-2.5 rounded-md text-sm font-medium hover:bg-gray-800"
          >
            {selfie ? 'Continue' : 'Skip'}
          </button>
        </div>
      </div>
    )
  }

  // Step: Review + submit
  const selectedType = DOCUMENT_TYPES.find(d => d.value === docType)
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Review & submit</h3>
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
        <div className="flex justify-between px-4 py-3">
          <span className="text-gray-500">Document type</span>
          <span className="font-medium">{selectedType?.label}</span>
        </div>
        <div className="flex justify-between px-4 py-3">
          <span className="text-gray-500">Front</span>
          <span className="font-medium text-green-600">Uploaded</span>
        </div>
        {requiresBack && (
          <div className="flex justify-between px-4 py-3">
            <span className="text-gray-500">Back</span>
            <span className="font-medium text-green-600">Uploaded</span>
          </div>
        )}
        <div className="flex justify-between px-4 py-3">
          <span className="text-gray-500">Selfie</span>
          <span className={selfie ? 'font-medium text-green-600' : 'text-gray-400'}>
            {selfie ? 'Uploaded' : 'Skipped'}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        By submitting you confirm these documents belong to you and are accurate.
        Verification typically takes 1–2 business days.
      </p>

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="flex gap-3">
        <button onClick={() => setStep('selfie')} disabled={isPending} className="flex-1 border border-gray-300 rounded-md py-2.5 text-sm hover:bg-gray-50 disabled:opacity-40">Back</button>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="flex-1 bg-black text-white py-2.5 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
        >
          {isPending ? 'Submitting…' : 'Submit for verification'}
        </button>
      </div>
    </div>
  )
}
