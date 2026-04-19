import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  return (
    <div className="editor-toolbar-actions" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        title="Kalın"
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        title="İtalik"
      >
        <Italic size={16} />
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        title="Altı Çizili"
      >
        <Underline size={16} />
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        title="Üstü Çizili"
      >
        <Strikethrough size={16} />
      </button>

      <div className="toolbar-divider" />

      <button
        type="button"
        className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        title="Sola Hizala"
      >
        <AlignLeft size={16} />
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        title="Ortala"
      >
        <AlignCenter size={16} />
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        title="Sağa Hizala"
      >
        <AlignRight size={16} />
      </button>

      <div className="toolbar-divider" />

      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Başlık 1"
      >
        <Heading1 size={16} />
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Başlık 2"
      >
        <Heading2 size={16} />
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Başlık 3"
      >
        <Heading3 size={16} />
      </button>

      <div className="toolbar-divider" />

      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Madde İşaretli Liste"
      >
        <List size={16} />
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numaralı Liste"
      >
        <ListOrdered size={16} />
      </button>

      <div className="toolbar-divider" />

      <button
        type="button"
        className="toolbar-btn"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Geri Al"
      >
        <Undo size={16} />
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Yinele"
      >
        <Redo size={16} />
      </button>

      <style>{`
        .toolbar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          transition: all 0.2s;
        }
        .toolbar-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }
        .toolbar-btn.active {
          background: rgba(217, 119, 6, 0.15);
          color: var(--accent);
        }
        .toolbar-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .toolbar-divider {
          width: 1px;
          height: 20px;
          background: var(--border);
          margin: 0 0.2rem;
        }
      `}</style>
    </div>
  );
}
