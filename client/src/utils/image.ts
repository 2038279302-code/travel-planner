/**
 * 图片处理工具：将用户选择的图片文件压缩为 base64 Data URL。
 * 项目未接入对象存储，为保持"零依赖、离线可用"，图片直接以压缩后的
 * base64 字符串形式存入 Note.images 数组，随笔记一起持久化到本地 SQLite。
 */

const MAX_EDGE = 1280; // 压缩后最长边（像素）
const JPEG_QUALITY = 0.75;
export const MAX_IMAGES_PER_NOTE = 9;
export const MAX_FILE_SIZE_MB = 15; // 原始文件大小上限（压缩前的粗筛）

/** 将单个图片文件读取并压缩为 base64 Data URL */
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('只能上传图片文件'));
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      reject(new Error(`图片过大，单张请控制在 ${MAX_FILE_SIZE_MB}MB 以内`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_EDGE || height > MAX_EDGE) {
          if (width >= height) {
            height = Math.round((height * MAX_EDGE) / width);
            width = MAX_EDGE;
          } else {
            width = Math.round((width * MAX_EDGE) / height);
            height = MAX_EDGE;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('浏览器不支持图片压缩'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** 批量压缩多个图片文件，单个失败不影响其他图片 */
export async function compressImageFiles(
  files: FileList | File[]
): Promise<{ ok: string[]; errors: string[] }> {
  const list = Array.from(files);
  const ok: string[] = [];
  const errors: string[] = [];
  for (const f of list) {
    try {
      ok.push(await compressImageFile(f));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : '图片处理失败');
    }
  }
  return { ok, errors };
}
