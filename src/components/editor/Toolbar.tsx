import { type Editor } from "@tiptap/react";
import { 
  RiBold, 
  RiItalic, 
  RiStrikethrough, 
  RiH1, 
  RiH2, 
  RiListUnordered, 
  RiListOrdered 
} from "react-icons/ri";

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

  const buttonClass = (isActive: boolean) => 
    `rounded-lg p-2 transition-colors ${
      isActive 
        ? "bg-[#262626] text-white" 
        : "text-[#a1a1aa] hover:bg-[#262626] hover:text-[#e5e5e5]"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        onClick={toggleBold}
        className={buttonClass(editor.isActive("bold"))}
        title="Bold"
      >
        <RiBold className="h-4 w-4" />
      </button>
      <button
        onClick={toggleItalic}
        className={buttonClass(editor.isActive("italic"))}
        title="Italic"
      >
        <RiItalic className="h-4 w-4" />
      </button>
      <button
        onClick={toggleStrike}
        className={buttonClass(editor.isActive("strike"))}
        title="Strikethrough"
      >
        <RiStrikethrough className="h-4 w-4" />
      </button>

      <div className="mx-1.5 h-6 w-[1px] bg-[#404040]/50" />

      <button
        onClick={toggleH1}
        className={buttonClass(editor.isActive("heading", { level: 1 }))}
        title="Heading 1"
      >
        <RiH1 className="h-4 w-4" />
      </button>
      <button
        onClick={toggleH2}
        className={buttonClass(editor.isActive("heading", { level: 2 }))}
        title="Heading 2"
      >
        <RiH2 className="h-4 w-4" />
      </button>

      <div className="mx-1.5 h-6 w-[1px] bg-[#404040]/50" />

      <button
        onClick={toggleBulletList}
        className={buttonClass(editor.isActive("bulletList"))}
        title="Bullet List"
      >
        <RiListUnordered className="h-4 w-4" />
      </button>
      <button
        onClick={toggleOrderedList}
        className={buttonClass(editor.isActive("orderedList"))}
        title="Ordered List"
      >
        <RiListOrdered className="h-4 w-4" />
      </button>
    </div>
  );
}
