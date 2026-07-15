import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'

import { uploadImage } from '../../lib/content-api'
import { Button, ImageUploader, type ImageUploaderHandle, usePrompt, useToast } from '../ui'

type RichTextEditorProps = {
  label?: string
  value: string
  onChange: (html: string) => void
}

export const RichTextEditor = ({ label, value, onChange }: RichTextEditorProps) => {
  const prompt = usePrompt()
  const toast = useToast()
  const uploaderRef = useRef<ImageUploaderHandle>(null)

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

  const setLink = async () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = await prompt({
      title: 'URL ссылки',
      defaultValue: previousUrl ?? 'https://',
      confirmLabel: 'OK',
    })
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const addImageByUrl = async () => {
    const url = await prompt({
      title: 'URL изображения',
      defaultValue: 'https://',
      confirmLabel: 'OK',
    })
    if (!url) return
    editor.chain().focus().setImage({ src: url }).run()
  }

  const addImageByUpload = () => {
    uploaderRef.current?.openPicker()
  }

  const onImageUpload = async (file: File) => {
    try {
      const uploaded = await uploadImage(file)
      editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.alt }).run()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить изображение'
      toast.error(message)
      throw err
    }
  }

  return (
    <div className="tiptap-editor">
      {label ? <span className="muru-field__label">{label}</span> : null}
      <div className="tiptap-toolbar">
        <Button
          type="button"
          variant="ghost"
          className="tiptap-toolbar__btn"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="tiptap-toolbar__btn"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="tiptap-toolbar__btn"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="tiptap-toolbar__btn"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          UL
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="tiptap-toolbar__btn"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          OL
        </Button>
        <Button type="button" variant="ghost" className="tiptap-toolbar__btn" onClick={() => void setLink()}>
          Link
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="tiptap-toolbar__btn"
          onClick={() => void addImageByUrl()}
        >
          Img URL
        </Button>
        <Button type="button" variant="ghost" className="tiptap-toolbar__btn" onClick={addImageByUpload}>
          Img upload
        </Button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
      <ImageUploader
        ref={uploaderRef}
        className="muru-image-uploader--hidden"
        onUpload={onImageUpload}
      />
    </div>
  )
}
