import { Router } from 'express';
import { ExpenseRepo } from '../db/repositories';
import { validateBody, expenseSchema, expenseUpdateSchema } from '../lib/validate';
import { requireTripExists } from '../lib/tripGuard';

const router = Router({ mergeParams: true });

/** 某旅行下的所有花销 */
router.get('/', async (req, res, next) => {
  try {
    const { tripId } = req.params as { tripId: string };
    res.json(await ExpenseRepo.byTrip(tripId));
  } catch (err) {
    next(err);
  }
});

// 以下写操作统一前置校验所属旅行存在（P1-4）；
// 花销日期不强制限制在旅行时间范围内（兼顾提前采购/事后报销等场景，P1-1 诺断中的产品判断）。
router.use(requireTripExists);

/** 新增花销 */
router.post('/', validateBody(expenseSchema), async (req, res, next) => {
  try {
    const { tripId } = req.params as { tripId: string };
    const d = req.body;
    const expense = await ExpenseRepo.create(tripId, {
      title: d.title,
      category: d.category,
      amount: d.amount,
      date: d.date ? new Date(d.date).toISOString() : new Date().toISOString(),
    });
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

/** 更新花销 */
router.put('/:id', validateBody(expenseUpdateSchema), async (req, res, next) => {
  try {
    const d = { ...req.body };
    if (d.date) d.date = new Date(d.date).toISOString();
    const expense = await ExpenseRepo.update(req.params.id, d);
    if (!expense) return res.status(404).json({ error: '花销不存在' });
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

/** 删除花销 */
router.delete('/:id', async (req, res, next) => {
  try {
    await ExpenseRepo.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
