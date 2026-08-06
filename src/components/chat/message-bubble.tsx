import { cn, formatDate } from '@/lib/utils'
import type { ChatMessage } from '@/types/app'

interface Props {
  message: ChatMessage
  isOwn: boolean
}

export function MessageBubble({ message, isOwn }: Props) {
  const isSystem = message.sender_type === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.body}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1 max-w-[72%]', isOwn ? 'self-end items-end' : 'self-start items-start')}>
      {message.is_internal_note && (
        <span className="text-xs text-amber-600 font-medium">Internal Note</span>
      )}
      <div className={cn(
        'rounded-2xl px-4 py-2 text-sm leading-relaxed',
        isOwn
          ? 'bg-black text-white rounded-br-sm'
          : 'bg-gray-100 text-gray-900 rounded-bl-sm',
        message.is_internal_note && 'bg-amber-50 text-amber-900 border border-amber-200'
      )}>
        {message.body}
      </div>
      {message.message_attachments?.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          {message.message_attachments.map(att => (
            <a
              key={att.id}
              href={att.file_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 underline"
            >
              {att.file_name}
            </a>
          ))}
        </div>
      )}
      <span className="text-xs text-gray-400">{formatDate(message.created_at)}</span>
    </div>
  )
}
