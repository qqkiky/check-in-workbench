import type { ChangeEvent, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

// Some Android IMEs commit through input/compositionend without React's change event.
// Read the native value synchronously; leave selection and composing text to the IME.
export function TextInput({ onChange, onInput, onCompositionEnd, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} onChange={onChange}
    onInput={event => { onInput?.(event); onChange?.(event as ChangeEvent<HTMLInputElement>) }}
    onCompositionEnd={event => { onCompositionEnd?.(event); onChange?.(event as unknown as ChangeEvent<HTMLInputElement>) }}/>
}

export function TextArea({ onChange, onInput, onCompositionEnd, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} onChange={onChange}
    onInput={event => { onInput?.(event); onChange?.(event as ChangeEvent<HTMLTextAreaElement>) }}
    onCompositionEnd={event => { onCompositionEnd?.(event); onChange?.(event as unknown as ChangeEvent<HTMLTextAreaElement>) }}/>
}
