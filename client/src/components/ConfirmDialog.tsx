import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** 主要描述文案 */
  message: string;
  /** 可选：展示将被一并删除的关联数据统计，如 ['3 条行程', '5 笔花销'] */
  impactList?: string[];
  /** 确认按钮文案，默认"删除" */
  confirmLabel?: string;
  /** 取消按钮文案，默认"取消" */
  cancelLabel?: string;
  /** 是否为危险操作（红色按钮），默认 true */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 通用二次确认弹窗（P0-3）：替换项目中散落的浏览器原生 confirm()。
 * 相比原生 confirm，能展示更丰富的上下文信息（如即将级联删除的子数据数量），
 * 且视觉与全局风格统一、跨浏览器表现一致。
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  impactList,
  confirmLabel = '删除',
  cancelLabel = '取消',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel} maxWidth="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{message}</p>

        {impactList && impactList.length > 0 && (
          <div className="bg-red-50 rounded-2xl px-4 py-3 text-sm text-red-500">
            <p className="font-medium mb-1">⚠️ 以下关联数据将被一并删除：</p>
            <ul className="list-disc list-inside space-y-0.5">
              {impactList.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`flex-1 px-4 py-2.5 rounded-2xl font-medium text-white transition-colors disabled:opacity-50 ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-pink hover:bg-brand-pink/90'
            }`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
