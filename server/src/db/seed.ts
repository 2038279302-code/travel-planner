import { initDb, run, persist } from './index';
import { TripRepo, ActivityRepo, ExpenseRepo, NoteRepo } from './repositories';

async function seed() {
  await initDb();
  console.log('🌱 开始写入种子数据...');

  // 清空旧数据
  run('DELETE FROM Note', []);
  run('DELETE FROM Expense', []);
  run('DELETE FROM Activity', []);
  run('DELETE FROM Trip', []);

  const iso = (s: string) => new Date(s).toISOString();

  // ===== 旅行 1：东京樱花之旅 =====
  const tokyo = TripRepo.create({
    title: '东京樱花之旅',
    type: 'travel',
    destination: '日本·东京',
    description: '春天去看樱花，逛吃逛吃，体验地道日式生活。',
    coverColor: '#FF6B9D',
    coverEmoji: '🌸',
    startDate: iso('2025-04-01'),
    endDate: iso('2025-04-04'),
    budget: 12000,
    status: 'completed',
  });

  const tA = (
    dayDate: string,
    startTime: string,
    title: string,
    category: string,
    location: string | null,
    note: string | null,
    cost: number,
    done: boolean,
    order: number
  ) =>
    ActivityRepo.create(tokyo.id, {
      dayDate: iso(dayDate),
      startTime,
      endTime: null,
      title,
      category,
      location,
      note,
      cost,
      done,
      order,
    });

  tA('2025-04-01', '10:00', '浅草寺 & 雷门', 'sightseeing', '台东区', '求个签，吃人形烧', 0, true, 0);
  tA('2025-04-01', '12:30', '一兰拉面', 'food', '浅草', '招牌豚骨', 80, true, 1);
  tA('2025-04-01', '15:00', '上野公园赏樱', 'sightseeing', '上野', '樱花满开！', 0, true, 2);
  tA('2025-04-02', '09:30', 'teamLab 数字艺术馆', 'sightseeing', '丰洲', '需提前预约', 220, true, 0);
  tA('2025-04-02', '14:00', '银座购物', 'other', '银座', '伴手礼', 1500, true, 1);

  const tE = (title: string, category: string, amount: number, date: string) =>
    ExpenseRepo.create(tokyo.id, { title, category, amount, date: iso(date) });
  tE('往返机票', 'transport', 4200, '2025-03-20');
  tE('酒店 3 晚', 'hotel', 3600, '2025-04-01');
  tE('teamLab 门票', 'ticket', 220, '2025-04-02');
  tE('银座购物', 'shopping', 1500, '2025-04-02');
  tE('餐饮合计', 'food', 1800, '2025-04-03');

  NoteRepo.create(tokyo.id, {
    title: '樱花满开的那一天',
    content:
      '上野公园的樱花开得正好，粉色的花瓣随风飘落，坐在树下吃便当，感觉整个春天都属于自己。这一刻所有的疲惫都值得了。',
    mood: '🥰',
    date: iso('2025-04-01'),
    images: [],
  });

  // ===== 旅行 2：上海客户拜访 =====
  const shanghai = TripRepo.create({
    title: '上海客户拜访',
    type: 'business',
    destination: '中国·上海',
    description: 'Q2 重点客户拜访，顺便见见老朋友。',
    coverColor: '#667EEA',
    coverEmoji: '💼',
    startDate: iso('2025-05-12'),
    endDate: iso('2025-05-14'),
    budget: 5000,
    status: 'ongoing',
  });

  ActivityRepo.create(shanghai.id, { dayDate: iso('2025-05-12'), startTime: '14:00', endTime: null, title: '抵达虹桥 & 入住', category: 'transport', location: '虹桥', note: null, cost: 0, done: false, order: 0 });
  ActivityRepo.create(shanghai.id, { dayDate: iso('2025-05-13'), startTime: '09:30', endTime: null, title: '客户A 季度会议', category: 'meeting', location: '陆家嘴', note: '带好材料', cost: 0, done: false, order: 0 });
  ActivityRepo.create(shanghai.id, { dayDate: iso('2025-05-13'), startTime: '19:00', endTime: null, title: '外滩商务晚宴', category: 'food', location: '外滩', note: null, cost: 800, done: false, order: 1 });

  ExpenseRepo.create(shanghai.id, { title: '高铁票', category: 'transport', amount: 560, date: iso('2025-05-12') });
  ExpenseRepo.create(shanghai.id, { title: '酒店 2 晚', category: 'hotel', amount: 1600, date: iso('2025-05-12') });

  // ===== 旅行 3：莫干山周末民宿 =====
  const moganshan = TripRepo.create({
    title: '莫干山周末民宿',
    type: 'weekend',
    destination: '中国·莫干山',
    description: '逃离城市，去山里住两天，发发呆。',
    coverColor: '#43E97B',
    coverEmoji: '⛰️',
    startDate: iso('2025-06-21'),
    endDate: iso('2025-06-22'),
    budget: 2000,
    status: 'planning',
  });

  ActivityRepo.create(moganshan.id, { dayDate: iso('2025-06-21'), startTime: '10:00', endTime: null, title: '自驾出发', category: 'transport', location: null, note: null, cost: 200, done: false, order: 0 });
  ActivityRepo.create(moganshan.id, { dayDate: iso('2025-06-21'), startTime: '14:00', endTime: null, title: '民宿入住 & 下午茶', category: 'hotel', location: '莫干山', note: null, cost: 0, done: false, order: 1 });
  ActivityRepo.create(moganshan.id, { dayDate: iso('2025-06-22'), startTime: '08:00', endTime: null, title: '山间徒步', category: 'sightseeing', location: null, note: null, cost: 0, done: false, order: 0 });

  persist();
  console.log('✅ 种子数据写入完成！共 3 个旅行示例。');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
