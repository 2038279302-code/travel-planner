import { Router } from 'express';
import { validateBody, aiRecommendSchema, aiRegenerateDaySchema } from '../lib/validate';
import { generateItinerary, regenerateDay } from '../services/aiService';
import { getInspirations } from '../services/inspirationService';
import { createRateLimiter } from '../lib/rateLimit';

const router = Router();

// AI 生成类接口限流：每 IP 每分钟最多 10 次，防止被脚本刷调用导致 API Key 费用失控（P1-5）
const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'AI 生成请求过于频繁，请稍后再试（每分钟最多 10 次）',
});

/** AI 行程推荐 */
router.post('/recommend', aiRateLimiter, validateBody(aiRecommendSchema), async (req, res, next) => {
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
  aiRateLimiter,
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
