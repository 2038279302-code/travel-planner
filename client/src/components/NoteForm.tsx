import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Note } from '../types';
import { fmtDate, localDateToISO } from '../utils/format';
import { compressImageFiles, MAX_IMAGES_PER_NOTE } from '../utils/image';
import { useStore } from '../store/useStore';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';
import FieldError from './FieldError';

const MOODS = ['😊', '🥰', '😎', '🤩', '😌', '😋', '🥳', '😮', '🥹', '😴'];

interface Props {
  initial?: Partial<Note>;
  onSubmit: (data: Partial<Note>) => void | Promise<void>;
  onCancel: () => void;
}

export default function NoteForm({ initial, onSubmit, onCancel }: Props) {
  const { toast } = useStore();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [mood, setMood] = useState(initial?.mood ?? '😊');
  const [date, setDate] = useState(
    initial?.date ? fmtDate(initial.date) : fmtDate(new Date().toISOString())
  );
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | undefined>();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // 图片预览打开时锁定背后页面滚动，避免移动端出现滚动穿透
  useLockBodyScroll(!!preview);

  // ESC 键关闭图片预览。用捕获阶段监听并阻止冒泡，
  // 避免同一次 ESC 按键被外层 Modal 的监听器同时捕获、导致表单也被一并关闭
  useEffect(() => {
    if (!preview) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPreview(null);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [preview]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remain = MAX_IMAGES_PER_NOTE - images.length;
    if (remain <= 0) {
      toast(`最多添加 ${MAX_IMAGES_PER_NOTE} 张图片`, 'error');
      return;
    }
    const picked = Array.from(files).slice(0, remain);
    setUploading(true);
    try {
      const { ok, errors } = await compressImageFiles(picked);
      if (ok.length > 0) setImages((prev) => [...prev, ...ok]);
      if (errors.length > 0) toast(errors[0], 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!content.trim()) {
      setContentError('请写下这次旅行的记录内容');
      toast('请先写点什么吧', 'error');
      contentRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim() || null,
        content: content.trim(),
        mood,
        date: localDateToISO(date), // 本地时间转 ISO，避免时区偏移少一天
        images,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="note-title" className="text-sm text-gray-500 mb-1 block">标题</label>
          <input
            id="note-title"
            className="input"
            value={title ?? ''}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="选填"
          />
        </div>
        <div>
          <label htmlFor="note-date" className="text-sm text-gray-500 mb-1 block">日期</label>
          <input
            id="note-date"
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">心情</label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="心情">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mood === m}
              onClick={() => setMood(m)}
              className={`w-9 h-9 rounded-xl text-lg transition-all ${
                mood === m
                  ? 'bg-brand-pink/15 ring-2 ring-brand-pink/40 scale-110'
                  : 'hover:bg-gray-100'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="note-content" className="text-sm text-gray-500 mb-1 block">记录正文 *</label>
        <textarea
          id="note-content"
          ref={contentRef}
          className={`input resize-none ${contentError ? 'input-error' : ''}`}
          rows={5}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (contentError) setContentError(undefined);
          }}
          placeholder="写下此刻的所见所感～"
          aria-invalid={!!contentError}
          aria-describedby={contentError ? 'note-content-error' : undefined}
        />
        <FieldError id="note-content-error" message={contentError} />
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">
          照片 {images.length > 0 && <span className="text-gray-300">({images.length}/{MAX_IMAGES_PER_NOTE})</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {images.map((src, idx) => (
            <div key={idx} className="relative group w-16 h-16 shrink-0">
              <button
                type="button"
                onClick={() => setPreview(src)}
                aria-label={`预览第 ${idx + 1} 张照片`}
                className="block w-16 h-16 p-0 border-0 rounded-xl overflow-hidden focus-visible:ring-2 focus-visible:ring-brand-pink/50"
              >
                <img
                  src={src}
                  alt={`照片 ${idx + 1}`}
                  className="w-16 h-16 rounded-xl object-cover cursor-pointer border border-gray-100"
                />
              </button>
              <button
                type="button"
                onClick={() => removeImage(idx)}
                aria-label={`删除第 ${idx + 1} 张照片`}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-800/80 text-white text-xs flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES_PER_NOTE && (
            <div
              className={`relative w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 text-gray-300 hover:border-brand-pink/40 hover:text-brand-pink flex items-center justify-center text-2xl transition-colors shrink-0 ${
                uploading ? 'opacity-50' : ''
              }`}
            >
              {uploading ? '…' : '＋'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={uploading}
                onChange={(e) => handleFiles(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          取消
        </button>
        <button className="btn-primary flex-1" onClick={submit} disabled={submitting}>
          {submitting ? '保存中…' : '保存'}
        </button>
      </div>

      {preview &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70"
            onClick={() => setPreview(null)}
          >
            <button
              onClick={() => setPreview(null)}
              aria-label="关闭预览"
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            >
              ✕
            </button>
            <img
              src={preview}
              alt="预览"
              className="max-w-full max-h-full rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
