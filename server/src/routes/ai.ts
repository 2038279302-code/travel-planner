import { Router } from 'express';
import { validateBody, aiRecommendSchema, aiRegenerateDaySchema } from '../lib/validate';
import { generateItinerary, regenerateDay } from '../services/aiService';
import { getInspirations } from '../services/inspirationService';

const router = Router();

/** AI 行程推荐 */
router.post('/recommend', validateBody(aiRecommendSchema), async (req, res, next) => {
  try {
    const result = await generateItinerary(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** AI 局部重新生成某一天（"换一换""更轻松""多点美食"等） */
router.post(
  '/regenerate-day',
  validateBody(aiRegenerateDaySchema),
  async (req, res, next) => {
    try {
      const result = await regenerateDay(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/** 灵感发现（小红书风格卡片） */
router.get('/inspirations', async (req, res, next) => {
  try {
    const keyword = (req.query.keyword as string) || undefined;
    const result = await getInspirations(keyword);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
