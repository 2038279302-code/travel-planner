/**
 * 数字类输入的通用校验（P1-2）：
 * 避免非法输入被静默转换成 0（如 `Number('abc') || 0` 这种写法会吞掉用户的错误输入），
 * 统一给出人类可读的错误信息，供各表单在提交前调用。
 */

/** 预算/金额上限：1000 万，与服务端 tripSchema.budget 上限保持一致 */
export const MAX_BUDGET = 10_000_000;
/** 单项花费上限：100 万，与服务端 activitySchema.cost / expenseSchema.amount 上限保持一致 */
export const MAX_COST = 1_000_000;

export interface NumberValidationOptions {
  /** 是否允许为空（为空时不报错，交由业务侧决定默认值） */
  allowEmpty?: boolean;
  /** 是否允许 0 */
  allowZero?: boolean;
  /** 最大值 */
  max?: number;
  /** 字段中文名，用于拼接错误信息 */
  label: string;
}

/**
 * 校验一个"数字输入框"的字符串值，返回错误信息（无错误则返回 undefined）。
 * 覆盖场景：非数字字符、负数、超出上限、（可选）为 0。
 */
export function validateNumberInput(
  raw: string,
  { allowEmpty = true, allowZero = true, max, label }: NumberValidationOptions
): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return allowEmpty ? undefined : `请填写${label}`;
  }
  const n = Number(trimmed);
  if (Number.isNaN(n)) {
    return `${label}请输入有效数字`;
  }
  if (n < 0) {
    return `${label}不能为负数`;
  }
  if (!allowZero && n === 0) {
    return `${label}需大于 0`;
  }
  if (max !== undefined && n > max) {
    return `${label}不能超过 ${max.toLocaleString('zh-CN')}`;
  }
  return undefined;
}
