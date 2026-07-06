import { useRef, useState } from 'react';
import type { Note } from '../types';
import { fmtDate, localDateToISO } from '../utils/format';
import { compressImageFiles, MAX_IMAGES_PER_NOTE } from '../utils/image';
import { useStore } from '../store/useStore';

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
    if (!content.trim()) return;
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">标题</label>
          <input
            className="input"
            value={title ?? ''}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="选填"
          />
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-1 block">日期</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">心情</label>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m}
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
        <label className="text-sm text-gray-500 mb-1 block">记录正文 *</label>
        <textarea
          className="input resize-none"
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写下此刻的所见所感～"
        />
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1.5 block">
          照片 {images.length > 0 && <span className="text-gray-300">({images.length}/{MAX_IMAGES_PER_NOTE})</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {images.map((src, idx) => (
            <div key={idx} className="relative group w-16 h-16 shrink-0">
              <img
                src={src}
                alt={`照片 ${idx + 1}`}
                className="w-16 h-16 rounded-xl object-cover cursor-pointer border border-gray-100"
                onClick={() => setPreview(src)}
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-800/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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

      {preview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70"
          onClick={() => setPreview(null)}
        >
          <img src={preview} alt="预览" className="max-w-full max-h-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
