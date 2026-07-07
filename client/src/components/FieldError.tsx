/** 表单字段下方的错误提示文案，配合 .input 的 error 态一起使用 */
export default function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-red-500 mt-1">
      ⚠️ {message}
    </p>
  );
}
