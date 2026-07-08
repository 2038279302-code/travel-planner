import { Router } from 'express';
import { TripRepo, ExpenseRepo } from '../db/repositories';
import { validateBody, tripSchema, tripUpdateSchema, tripWithActivitiesSchema } from '../lib/validate';

const router = Router();

/** 获取所有旅行 */
router.get('/', (_req, res, next) => {
  try {
    res.json(TripRepo.all());
  } catch (err) {
    next(err);
  }
});

/** 仪表盘统计数据 */
router.get('/stats/overview', (_req, res, next) => {
  try {
    const trips = TripRepo.all();

    const totalTrips = trips.length;
    const completed = trips.filter((t) => t.status === 'completed').length;
    const ongoing = trips.filter((t) => t.status === 'ongoing').length;
    const planning = trips.filter((t) => t.status === 'planning').length;

    const destinations = new Set(
      trips.map((t) => t.destination.split(/[·\s,，]/)[0]).filter(Boolean)
    );

    let totalSpent = 0;
    let totalBudget = 0;
    for (const t of trips) {
      totalBudget += t.budget;
      const expenses = ExpenseRepo.byTrip(t.id);
      totalSpent += expenses.reduce((s, e) => s + e.amount, 0);
    }

    res.json({
      totalTrips,
      completed,
      ongoing,
      planning,
      destinationCount: destinations.size,
      totalSpent,
      totalBudget,
    });
  } catch (err) {
    next(err);
  }
});

/** AI 一键保存：批量创建旅行 + 行程项（P0-5） */
router.post('/with-activities', validateBody(tripWithActivitiesSchema), (req, res, next) => {
  try {
    const { trip: t, activities } = req.body;
    const result = TripRepo.createWithActivities(
      {
        title: t.title,
        type: t.type,
        destination: t.destination,
        description: t.description ?? null,
        coverColor: t.coverColor,
        coverEmoji: t.coverEmoji,
        startDate: new Date(t.startDate).toISOString(),
        endDate: new Date(t.endDate).toISOString(),
        budget: t.budget,
        status: t.status,
      },
      activities.map((a: any) => ({
        dayDate: new Date(a.dayDate).toISOString(),
        startTime: a.startTime ?? null,
        title: a.title,
        category: a.category,
        note: a.note ?? null,
        cost: a.cost,
        order: a.order,
      }))
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** 单个旅行详情（含全部子数据） */
router.get('/:id', (req, res, next) => {
  try {
    const trip = TripRepo.findWithChildren(req.params.id);
    if (!trip) return res.status(404).json({ error: '旅行不存在' });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

/** 创建旅行 */
router.post('/', validateBody(tripSchema), (req, res, next) => {
  try {
    const d = req.body;
    const trip = TripRepo.create({
      title: d.title,
      type: d.type,
      destination: d.destination,
      description: d.description ?? null,
      coverColor: d.coverColor,
      coverEmoji: d.coverEmoji,
      startDate: new Date(d.startDate).toISOString(),
      endDate: new Date(d.endDate).toISOString(),
      budget: d.budget,
      status: d.status,
    });
    res.status(201).json(trip);
  } catch (err) {
    next(err);
  }
});

/** 更新旅行 */
router.put('/:id', validateBody(tripUpdateSchema), (req, res, next) => {
  try {
    const d = { ...req.body };
    if (d.startDate) d.startDate = new Date(d.startDate).toISOString();
    if (d.endDate) d.endDate = new Date(d.endDate).toISOString();
    const trip = TripRepo.update(req.params.id, d);
    if (!trip) return res.status(404).json({ error: '旅行不存在' });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

/** 删除旅行（级联） */
router.delete('/:id', (req, res, next) => {
  try {
    TripRepo.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
