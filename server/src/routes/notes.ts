import { Router } from 'express';
import { NoteRepo } from '../db/repositories';
import { validateBody, noteSchema, noteUpdateSchema } from '../lib/validate';

const router = Router({ mergeParams: true });

/** 某旅行下的所有记录 */
router.get('/', (req, res, next) => {
  try {
    const { tripId } = req.params as { tripId: string };
    res.json(NoteRepo.byTrip(tripId));
  } catch (err) {
    next(err);
  }
});

/** 新增记录 */
router.post('/', validateBody(noteSchema), (req, res, next) => {
  try {
    const { tripId } = req.params as { tripId: string };
    const d = req.body;
    const note = NoteRepo.create(tripId, {
      title: d.title ?? null,
      content: d.content,
      mood: d.mood,
      date: d.date ? new Date(d.date).toISOString() : new Date().toISOString(),
      images: d.images ?? [],
    });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

/** 更新记录 */
router.put('/:id', validateBody(noteUpdateSchema), (req, res, next) => {
  try {
    const d = { ...req.body };
    if (d.date) d.date = new Date(d.date).toISOString();
    const note = NoteRepo.update(req.params.id, d);
    if (!note) return res.status(404).json({ error: '记录不存在' });
    res.json(note);
  } catch (err) {
    next(err);
  }
});

/** 删除记录 */
router.delete('/:id', (req, res, next) => {
  try {
    NoteRepo.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
