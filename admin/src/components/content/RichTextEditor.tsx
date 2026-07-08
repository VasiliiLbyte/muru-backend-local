import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

import { uploadImage } from '../../lib/content-api'

type RichTextEditorProps = {
  label?: string
  value: string
  onChange: (html: string) => void
}

export const RichTextEditor = ({ label, value, onChange }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) {
    return <p className="muted-text">Загрузка редактора...</p>
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL ссылки', previousUrl ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const addImageByUrl = () => {
    const url = window.prompt('URL изображения')
    if (!url) return
    editor.chain().focus().setImage({ src: url }).run()
  }

  const addImageByUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const uploaded = await uploadImage(file)
        editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.alt }).run()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        window.alert(message)
      }
    }
    input.click()
  }

  return (
    <div className="tiptap-editor">
      {label ? <span className="field-label">{label}</span> : null}
      <div className="tiptap-toolbar">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          UL
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          OL
        </button>
        <button type="button" onClick={setLink}>
          Link
        </button>
        <button type="button" onClick={addImageByUrl}>
          Img URL
        </button>
        <button type="button" onClick={addImageByUpload}>
          Img upload
        </button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  )
}
