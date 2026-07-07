import { Router } from 'express';
import { ActivityRepo } from '../db/repositories';
import {
  validateBody,
  activitySchema,
  activityUpdateSchema,
  activityReorderSchema,
} from '../lib/validate';

const router = Router({ mergeParams: true });

/** 某旅行下的所有行程项 */
router.get('/', (req, res, next) => {
  try {
    const { tripId } = req.params as { tripId: string };
    res.json(ActivityRepo.byTrip(tripId));
  } catch (err) {
    next(err);
  }
});

/** 新增行程项 */
router.post('/', validateBody(activitySchema), (req, res, next) => {
  try {
    const { tripId } = req.params as { tripId: string };
    const d = req.body;
    const activity = ActivityRepo.create(tripId, {
      dayDate: new Date(d.dayDate).toISOString(),
      startTime: d.startTime ?? null,
      endTime: d.endTime ?? null,
      title: d.title,
      category: d.category,
      location: d.location ?? null,
      note: d.note ?? null,
      cost: d.cost,
      done: d.done,
      order: d.order,
    });
    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
});

/** 拖拽排序：批量更新行程项的日期与顺序（需放在 /:id 之前，避免被误匹配） */
router.patch('/reorder', validateBody(activityReorderSchema), (req, res, next) => {
  try {
    const { items } = req.body as { items: { id: string; dayDate: string; order: number }[] };
    const normalized = items.map((it) => ({
      ...it,
      dayDate: new Date(it.dayDate).toISOString(),
    }));
    const updated = ActivityRepo.reorder(normalized);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** 更新行程项 */
router.put('/:id', validateBody(activityUpdateSchema), (req, res, next) => {
  try {
    const d = { ...req.body };
    if (d.dayDate) d.dayDate = new Date(d.dayDate).toISOString();
    const activity = ActivityRepo.update(req.params.id, d);
    if (!activity) return res.status(404).json({ error: '行程项不存在' });
    res.json(activity);
  } catch (err) {
    next(err);
  }
});

/** 删除行程项 */
router.delete('/:id', (req, res, next) => {
  try {
    ActivityRepo.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
