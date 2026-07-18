'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { uploadTicketVideo, getTicketVideos, getVideoSignedUrl } from '@/lib/services/ticketService'

const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska']

interface Props {
  ticketId: string
  readOnly?: boolean
}

function VideoItem({ storagePath, fileName }: { storagePath: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const signed = await getVideoSignedUrl(storagePath)
      setUrl(signed)
    } finally {
      setLoading(false)
    }
  }

  if (url) {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-200 bg-black">
        <video src={url} controls className="w-full max-h-48 object-contain" />
        <p className="text-xs text-gray-400 px-2 py-1 truncate">{fileName}</p>
      </div>
    )
  }

  return (
    <button
      onClick={load}
      disabled={loading}
      className="flex items-center gap-2 w-full text-left border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-400 transition-colors text-sm"
    >
      <span className="text-gray-400">▶</span>
      <span className="flex-1 truncate text-gray-700">{fileName}</span>
      <span className="text-xs text-gray-400">{loading ? 'Loading…' : 'Play'}</span>
    </button>
  )
}

export function VideoUpload({ ticketId, readOnly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState(0)
  const [fileError, setFileError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: videos = [] } = useQuery({
    queryKey: ['videos', ticketId],
    queryFn: () => getTicketVideos(ticketId),
  })

  const { mutate: upload, isPending } = useMutation({
    mutationFn: (file: File) => uploadTicketVideo(ticketId, file, setProgress),
    onSuccess: () => {
      setProgress(0)
      queryClient.invalidateQueries({ queryKey: ['videos', ticketId] })
      if (inputRef.current) inputRef.current.value = ''
    },
    onError: (err: Error) => {
      setFileError(err.message)
      setProgress(0)
    },
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Unsupported format. Use MP4, MOV, WebM, or AVI.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setFileError('File exceeds 100 MB limit.')
      return
    }
    upload(file)
  }

  return (
    <div className="space-y-3">
      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map(v => (
            <VideoItem key={v.id} storagePath={v.storage_path} fileName={v.file_name} />
          ))}
        </div>
      )}

      {!readOnly && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFile}
            className="hidden"
            id={`video-upload-${ticketId}`}
          />
          {isPending ? (
            <div className="space-y-1">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">Uploading… {progress}%</p>
            </div>
          ) : (
            <label
              htmlFor={`video-upload-${ticketId}`}
              className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg px-4 py-2 hover:border-gray-500 hover:text-black transition-colors"
            >
              <span>+</span> Attach video evidence
              <span className="text-xs text-gray-400">(MP4, MOV, WebM · max 100 MB)</span>
            </label>
          )}
          {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
        </div>
      )}

      {readOnly && videos.length === 0 && (
        <p className="text-xs text-gray-400">No videos attached.</p>
      )}
    </div>
  )
}
