import { type Editor } from "@tiptap/react";
import { Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered } from "lucide-react";

interface ToolbarProps {
  editor: Editor | null;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) {
    return null;
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleStrike = () => editor.chain().focus().toggleStrike().run();
  const toggleH1 = () => editor.chain().focus().toggleHeading({ level: 1 }).run();
  const toggleH2 = () => editor.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <button
        onClick={toggleBold}
        className={`rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${
          editor.isActive("bold") ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "text-slate-500"
        }`}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        onClick={toggleItalic}
        className={`rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${
          editor.isActive("italic") ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "text-slate-500"
        }`}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        onClick={toggleStrike}
        className={`rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${
          editor.isActive("strike") ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "text-slate-500"
        }`}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </button>

      <div className="mx-1 h-5 w-[1px] bg-slate-200 dark:bg-slate-800" />

      <button
        onClick={toggleH1}
        className={`rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${
          editor.isActive("heading", { level: 1 }) ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "text-slate-500"
        }`}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </button>
      <button
        onClick={toggleH2}
        className={`rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${
          editor.isActive("heading", { level: 2 }) ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "text-slate-500"
        }`}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </button>

      <div className="mx-1 h-5 w-[1px] bg-slate-200 dark:bg-slate-800" />

      <button
        onClick={toggleBulletList}
        className={`rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${
          editor.isActive("bulletList") ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "text-slate-500"
        }`}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={toggleOrderedList}
        className={`rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${
          editor.isActive("orderedList") ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "text-slate-500"
        }`}
        title="Ordered List"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
    </div>
  );
}
