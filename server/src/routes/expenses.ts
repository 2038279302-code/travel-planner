import { Router } from 'express';
import { ExpenseRepo } from '../db/repositories';
import { validateBody, expenseSchema, expenseUpdateSchema } from '../lib/validate';

const router = Router({ mergeParams: true });

/** 某旅行下的所有花销 */
router.get('/', (req, res, next) => {
  try {
    const { tripId } = req.params as { tripId: string };
    res.json(ExpenseRepo.byTrip(tripId));
  } catch (err) {
    next(err);
  }
});

/** 新增花销 */
router.post('/', validateBody(expenseSchema), (req, res, next) => {
  try {
    const { tripId } = req.params as { tripId: string };
    const d = req.body;
    const expense = ExpenseRepo.create(tripId, {
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
router.put('/:id', validateBody(expenseUpdateSchema), (req, res, next) => {
  try {
    const d = { ...req.body };
    if (d.date) d.date = new Date(d.date).toISOString();
    const expense = ExpenseRepo.update(req.params.id, d);
    if (!expense) return res.status(404).json({ error: '花销不存在' });
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

/** 删除花销 */
router.delete('/:id', (req, res, next) => {
  try {
    ExpenseRepo.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
