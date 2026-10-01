'use strict';
/* =========================================================================
 * DỮ LIỆU PHÁP LÝ & NỘI DUNG GAME
 * -------------------------------------------------------------------------
 * Căn cứ chính: Nghị định 168/2024/NĐ-CP (hiệu lực 01/01/2025).
 * - fine:   [mức tối thiểu, mức tối đa] (đồng)
 * - basis:  căn cứ điều/khoản/điểm
 * - extra:  hình thức bổ sung / trừ điểm GPLX
 * - verify: true = căn cứ điều/khoản hoặc mức trừ điểm CHƯA đối chiếu được
 *           với văn bản gốc -> cần kiểm tra lại trước khi dùng tuyên truyền.
 * Chỉ cần sửa file này để cập nhật khi văn bản thay đổi.
 * ========================================================================= */
const DATA = {};

DATA.LEGAL_NOTE =
  'Căn cứ: Nghị định 168/2024/NĐ-CP ngày 26/12/2024 của Chính phủ (hiệu lực 01/01/2025). ' +
  'Mục có dấu ⚠ là căn cứ điều/khoản hoặc mức trừ điểm cần đối chiếu lại văn bản gốc. ' +
  'Nội dung trong game chỉ mang tính giáo dục, tham khảo.';

DATA.VIOLATIONS = {
  /* ---------------- XE MÔ TÔ, XE GẮN MÁY (Điều 7, Điều 18) ---------------- */
  m_helmet:      { veh: 'moto', group: 'visible', name: 'Không đội mũ bảo hiểm hoặc đội mũ không cài quai đúng quy cách', fine: [400000, 600000], basis: 'Điểm h khoản 2 Điều 7', extra: '', verify: false },
  m_pass_helmet: { veh: 'moto', group: 'visible', name: 'Chở người ngồi trên xe không đội mũ bảo hiểm', fine: [400000, 600000], basis: 'Điểm i khoản 2 Điều 7', extra: '', verify: false },
  m_carry2:      { veh: 'moto', group: 'visible', name: 'Chở theo 02 người trên xe (quá số người quy định)', fine: [400000, 600000], basis: 'Khoản 2 Điều 7', extra: '', verify: true },
  m_phone:       { veh: 'moto', group: 'visible', name: 'Dùng tay cầm và sử dụng điện thoại khi đang điều khiển xe', fine: [800000, 1000000], basis: 'Khoản 4 Điều 7', extra: 'Trừ 04 điểm GPLX', verify: false },
  m_wrongway:    { veh: 'moto', group: 'visible', name: 'Đi ngược chiều của đường một chiều', fine: [4000000, 6000000], basis: 'Khoản 7 Điều 7', extra: 'Trừ 02 điểm GPLX', verify: true },
  m_redlight:    { veh: 'moto', group: 'event',   name: 'Không chấp hành hiệu lệnh của đèn tín hiệu giao thông (vượt đèn đỏ)', fine: [4000000, 6000000], basis: 'Khoản 7 Điều 7', extra: 'Trừ 04 điểm GPLX', verify: true },
  m_speed1:      { veh: 'moto', group: 'speed',   name: 'Chạy quá tốc độ quy định từ 05 km/h đến dưới 10 km/h', fine: [400000, 600000], basis: 'Điểm b khoản 2 Điều 7', extra: '', verify: false },
  m_speed2:      { veh: 'moto', group: 'speed',   name: 'Chạy quá tốc độ quy định từ 10 km/h đến 20 km/h', fine: [800000, 1000000], basis: 'Điểm a khoản 4 Điều 7', extra: '', verify: false },
  m_speed3:      { veh: 'moto', group: 'speed',   name: 'Chạy quá tốc độ quy định trên 20 km/h', fine: [6000000, 8000000], basis: 'Điểm a khoản 8 Điều 7', extra: 'Trừ 04 điểm GPLX', verify: false },
  m_alc1:        { veh: 'moto', group: 'alcohol', name: 'Nồng độ cồn chưa vượt quá 0,25 mg/1 lít khí thở', fine: [2000000, 3000000], basis: 'Điều 7', extra: 'Trừ 04 điểm GPLX', verify: true },
  m_alc2:        { veh: 'moto', group: 'alcohol', name: 'Nồng độ cồn vượt quá 0,25 mg đến 0,4 mg/1 lít khí thở', fine: [6000000, 8000000], basis: 'Điều 7', extra: 'Trừ 10 điểm GPLX', verify: true },
  m_alc3:        { veh: 'moto', group: 'alcohol', name: 'Nồng độ cồn vượt quá 0,4 mg/1 lít khí thở', fine: [8000000, 10000000], basis: 'Điều 7', extra: 'Tước quyền sử dụng GPLX từ 22 đến 24 tháng', verify: true },
  m_nolicense:   { veh: 'moto', group: 'docs',    name: 'Không có giấy phép lái xe (xe dung tích xi lanh đến 125 cm³)', fine: [2000000, 4000000], basis: 'Điều 18', extra: '', verify: true },
  m_nocarry_lic: { veh: 'moto', group: 'docs',    name: 'Không mang theo giấy phép lái xe', fine: [200000, 300000], basis: 'Điều 18', extra: '', verify: true },
  m_nocarry_reg: { veh: 'moto', group: 'docs',    name: 'Không mang theo chứng nhận đăng ký xe', fine: [200000, 300000], basis: 'Điểm c khoản 2 Điều 18', extra: '', verify: true },
  m_noins:       { veh: 'moto', group: 'docs',    name: 'Không có hoặc không mang theo Giấy chứng nhận bảo hiểm bắt buộc TNDS còn hiệu lực', fine: [200000, 300000], basis: 'Điều 18', extra: '', verify: true },

  /* ---------------- XE Ô TÔ (Điều 6, Điều 18) ---------------- */
  c_phone:       { veh: 'car', group: 'visible', name: 'Dùng tay cầm và sử dụng điện thoại khi đang điều khiển xe', fine: [4000000, 6000000], basis: 'Điều 6', extra: '', verify: true },
  c_redlight:    { veh: 'car', group: 'event',   name: 'Không chấp hành hiệu lệnh của đèn tín hiệu giao thông (vượt đèn đỏ)', fine: [18000000, 20000000], basis: 'Khoản 9 Điều 6', extra: 'Trừ 04 điểm GPLX (điểm b khoản 16 Điều 6)', verify: false },
  c_speed1:      { veh: 'car', group: 'speed',   name: 'Chạy quá tốc độ quy định từ 05 km/h đến dưới 10 km/h', fine: [800000, 1000000], basis: 'Điều 6', extra: '', verify: true },
  c_speed2:      { veh: 'car', group: 'speed',   name: 'Chạy quá tốc độ quy định từ 10 km/h đến 20 km/h', fine: [4000000, 6000000], basis: 'Điều 6', extra: '', verify: true },
  c_speed3:      { veh: 'car', group: 'speed',   name: 'Chạy quá tốc độ quy định trên 20 km/h đến 35 km/h', fine: [6000000, 8000000], basis: 'Điều 6', extra: '', verify: true },
  c_speed4:      { veh: 'car', group: 'speed',   name: 'Chạy quá tốc độ quy định trên 35 km/h', fine: [12000000, 14000000], basis: 'Điều 6', extra: 'Trừ 06 điểm GPLX', verify: true },
  c_alc1:        { veh: 'car', group: 'alcohol', name: 'Nồng độ cồn chưa vượt quá 0,25 mg/1 lít khí thở', fine: [6000000, 8000000], basis: 'Điều 6', extra: 'Trừ 04 điểm GPLX', verify: true },
  c_alc2:        { veh: 'car', group: 'alcohol', name: 'Nồng độ cồn vượt quá 0,25 mg đến 0,4 mg/1 lít khí thở', fine: [18000000, 20000000], basis: 'Điều 6', extra: 'Trừ 10 điểm GPLX', verify: true },
  c_alc3:        { veh: 'car', group: 'alcohol', name: 'Nồng độ cồn vượt quá 0,4 mg/1 lít khí thở', fine: [30000000, 40000000], basis: 'Điều 6', extra: 'Tước quyền sử dụng GPLX từ 22 đến 24 tháng', verify: true },
  c_nolicense:   { veh: 'car', group: 'docs',    name: 'Không có giấy phép lái xe', fine: [18000000, 20000000], basis: 'Điều 18', extra: '', verify: true },
  c_nocarry_lic: { veh: 'car', group: 'docs',    name: 'Không mang theo giấy phép lái xe', fine: [300000, 400000], basis: 'Điều 18', extra: '', verify: true },
  c_nocarry_reg: { veh: 'car', group: 'docs',    name: 'Không mang theo chứng nhận đăng ký xe', fine: [300000, 400000], basis: 'Điều 18', extra: '', verify: true },
  c_noins:       { veh: 'car', group: 'docs',    name: 'Không có hoặc không mang theo Giấy chứng nhận bảo hiểm bắt buộc TNDS còn hiệu lực', fine: [400000, 600000], basis: 'Điều 18', extra: '', verify: true },

  /* ---------------- CHUYÊN ĐỀ Ô TÔ: QUÁ TẢI, QUÁ KHỔ, XE KHÁCH (Điều 20, Điều 21) ---------------- */
  c_load1:       { veh: 'car', group: 'load',    name: 'Chở hàng vượt khối lượng hàng chuyên chở cho phép (ghi trong GCN kiểm định) trên 10% đến 30%', fine: [800000, 1000000], basis: 'Điều 21', extra: '', verify: true },
  c_load2:       { veh: 'car', group: 'load',    name: 'Chở hàng vượt khối lượng hàng chuyên chở cho phép trên 30% đến 50%', fine: [3000000, 5000000], basis: 'Điều 21', extra: '', verify: true },
  c_load3:       { veh: 'car', group: 'load',    name: 'Chở hàng vượt khối lượng hàng chuyên chở cho phép trên 50% đến 100%', fine: [5000000, 7000000], basis: 'Điều 21', extra: 'Trừ 04 điểm GPLX', verify: true },
  c_load4:       { veh: 'car', group: 'load',    name: 'Chở hàng vượt khối lượng hàng chuyên chở cho phép trên 100% đến 150%', fine: [7000000, 8000000], basis: 'Điều 21', extra: '', verify: true },
  c_height:      { veh: 'car', group: 'size',    name: 'Chở hàng vượt quá chiều cao xếp hàng cho phép (quá khổ)', fine: [2000000, 3000000], basis: 'Điều 21', extra: 'Trừ 02 điểm GPLX', verify: true },
  c_bus_over:    { veh: 'car', group: 'bus',     name: 'Chở quá số người được phép chở (xe chở hành khách, trừ xe buýt), tuyến dưới 300 km', fine: [400000, 600000], perPerson: true, basis: 'Điều 20', extra: 'Tính trên mỗi người vượt quá; tổng mức phạt không quá 75.000.000 đ', verify: true }
};

/* Tỷ lệ chở vượt khối lượng cho phép (%) -> mức (từ 10% trở xuống: chưa xử phạt) */
DATA.loadTier = function (over) {
  if (over <= 10) return null;
  if (over <= 30) return 1;
  if (over <= 50) return 2;
  if (over <= 100) return 3;
  return 4;
};
/* Khung phạt thực tế (nhân số người vượt quá với lỗi tính theo đầu người) */
DATA.fineOf = function (id, v) {
  const V = DATA.VIOLATIONS[id];
  if (!V.perPerson || !v || !v.busExcess) return V.fine;
  const cap = 75000000;
  return [Math.min(cap, V.fine[0] * v.busExcess), Math.min(cap, V.fine[1] * v.busExcess)];
};

/* Ngưỡng tốc độ (km/h vượt quá) -> hậu tố mã lỗi */
DATA.speedTier = function (veh, excess) {
  if (excess < 5) return null;
  if (excess < 10) return 1;
  if (excess <= 20) return 2;
  if (veh === 'moto') return 3;
  if (excess <= 35) return 3;
  return 4;
};
/* Nồng độ cồn (mg/l khí thở) -> mức */
DATA.alcoholLevel = function (mg) {
  if (mg <= 0) return 0;
  if (mg <= 0.25) return 1;
  if (mg <= 0.4) return 2;
  return 3;
};

/* ------------------------------ CA TUẦN TRA ------------------------------ */
/* p: xác suất phát sinh từng loại vi phạm trên mỗi phương tiện */
DATA.SHIFTS = [
  {
    id: 1, cpWait: 14, hints: true, name: 'Ca 1 · Ngày đầu nhận nhiệm vụ', short: 'Ngày đầu nhận nhiệm vụ',
    desc: 'Buổi sáng, tuyến phố gần trường học. Đội trưởng hướng dẫn quy trình dừng xe, kiểm tra và xử lý vi phạm.',
    map: 'city', time: '07:00', light: 'day', weather: 'clear', duration: 180,
    density: 0.8, mix: { moto: 0.8, car: 0.2, truck: 0 }, radar: false, checkpoint: false,
    p: { helmet: 0.16, passenger: 0.4, passHelmet: 0.35, carry2: 0.1, phone: 0, runRed: 0.02, wrongway: 0, speed: 0, alcohol: 0.02, noLic: 0.04, noCarryLic: 0.08, noCarryReg: 0.06, noIns: 0.1, vneid: 0.35 },
    react: { coop: 6, beg: 3, argue: 1 }, flee: 0, accident: false, tutorial: true,
    stars: [80, 180, 300]
  },
  {
    id: 2, cpWait: 10, name: 'Ca 2 · Giờ cao điểm', short: 'Giờ cao điểm',
    desc: 'Chiều tối, ngã tư đông xe. Chú ý vượt đèn đỏ, đi ngược chiều vào đường một chiều, dùng điện thoại khi lái xe.',
    map: 'city', time: '17:00', light: 'dusk', weather: 'clear', duration: 210,
    density: 1.25, mix: { moto: 0.75, car: 0.22, truck: 0.03 }, radar: false, checkpoint: false,
    p: { helmet: 0.08, passenger: 0.35, passHelmet: 0.25, carry2: 0.06, phone: 0.08, runRed: 0.12, wrongway: 0.3, speed: 0, alcohol: 0.03, noLic: 0.04, noCarryLic: 0.06, noCarryReg: 0.05, noIns: 0.08, vneid: 0.4 },
    react: { coop: 5, beg: 2, argue: 2, film: 2, connect: 1 }, flee: 0, accident: false,
    stars: [100, 220, 360]
  },
  {
    id: 3, cpWait: 10, name: 'Ca 3 · Chốt kiểm tra nồng độ cồn', short: 'Chốt nồng độ cồn',
    desc: 'Buổi tối, chốt kiểm soát theo kế hoạch. Được dừng mọi phương tiện để kiểm tra nồng độ cồn. Cảnh giác với hối lộ và bỏ chạy.',
    map: 'city', time: '21:00', light: 'night', weather: 'clear', duration: 210,
    density: 0.9, mix: { moto: 0.7, car: 0.27, truck: 0.03 }, radar: false, checkpoint: true,
    p: { helmet: 0.06, passenger: 0.3, passHelmet: 0.25, carry2: 0.05, phone: 0.03, runRed: 0.05, wrongway: 0.1, speed: 0, alcohol: 0.35, noLic: 0.05, noCarryLic: 0.06, noCarryReg: 0.05, noIns: 0.08, vneid: 0.4 },
    react: { coop: 4, beg: 3, bribe: 2, connect: 2, argue: 2, film: 1 }, flee: 0.08, accident: false,
    stars: [120, 260, 420]
  },
  {
    id: 4, cpWait: 9, name: 'Ca 4 · Tuần tra quốc lộ', short: 'Tuần tra quốc lộ',
    desc: 'Ban ngày trên quốc lộ, có máy đo tốc độ. Biển báo tốc độ tối đa 60 km/h. Xác định đúng mức vượt tốc độ.',
    map: 'highway', time: '10:00', light: 'day', weather: 'clear', duration: 210,
    density: 1.0, mix: { moto: 0.5, car: 0.38, truck: 0.12 }, radar: true, checkpoint: false,
    p: { helmet: 0.06, passenger: 0.3, passHelmet: 0.2, carry2: 0.05, phone: 0.07, runRed: 0, wrongway: 0, speed: 0.3, alcohol: 0.05, noLic: 0.05, noCarryLic: 0.06, noCarryReg: 0.05, noIns: 0.08, vneid: 0.4 },
    react: { coop: 5, beg: 2, argue: 3, film: 1, bribe: 1 }, flee: 0.04, accident: false,
    stars: [120, 260, 420]
  },
  {
    id: 5, cpWait: 9, name: 'Ca 5 · Đêm mưa', short: 'Đêm mưa',
    desc: 'Đêm mưa, tầm nhìn hạn chế. Tất cả loại vi phạm đều có thể xảy ra. Sẽ có tình huống tai nạn giao thông cần xử lý.',
    map: 'city', time: '22:00', light: 'night', weather: 'rain', duration: 240,
    density: 0.9, mix: { moto: 0.7, car: 0.26, truck: 0.04 }, radar: true, checkpoint: false,
    p: { helmet: 0.08, passenger: 0.3, passHelmet: 0.25, carry2: 0.05, phone: 0.05, runRed: 0.1, wrongway: 0.25, speed: 0.12, alcohol: 0.12, noLic: 0.05, noCarryLic: 0.06, noCarryReg: 0.05, noIns: 0.08, vneid: 0.4 },
    react: { coop: 4, beg: 2, argue: 2, film: 1, connect: 1, bribe: 1 }, flee: 0.05, accident: true,
    stars: [150, 320, 500]
  },
  {
    id: 6, cpWait: 9, name: 'Ca 6 · Khu công nghiệp tan ca', short: 'KCN tan ca',
    desc: 'Chiều tối, hàng nghìn công nhân tan ca, xe tải ra vào khu công nghiệp. Chú ý xe quá tải, quá khổ, chở quá số người.',
    map: 'industrial', time: '17:30', light: 'dusk', weather: 'clear', duration: 240,
    density: 1.2, mix: { moto: 0.72, car: 0.1, truck: 0.15, bus: 0.03 }, radar: false, checkpoint: false,
    p: { helmet: 0.1, passenger: 0.35, passHelmet: 0.3, carry2: 0.1, phone: 0.06, runRed: 0.1, wrongway: 0, speed: 0, alcohol: 0.06, noLic: 0.05, noCarryLic: 0.06, noCarryReg: 0.05, noIns: 0.08, vneid: 0.4, overload: 0.35, oversize: 0.2, busOver: 0.4 },
    react: { coop: 4, beg: 3, argue: 2, film: 1, connect: 1, bribe: 1 }, flee: 0.04, accident: false,
    stars: [150, 320, 500]
  },
  {
    id: 7, cpWait: 9, name: 'Ca 7 · Đường làng mùa lễ hội', short: 'Đường làng lễ hội',
    desc: 'Buổi tối mùa lễ hội ở vùng nông thôn: nhiều người uống rượu bia, đi xe không đội mũ, thanh niên tụ tập đua xe.',
    map: 'rural', time: '19:30', light: 'night', weather: 'clear', duration: 240,
    density: 0.85, mix: { moto: 0.85, car: 0.1, truck: 0.05 }, radar: false, checkpoint: false,
    p: { helmet: 0.18, passenger: 0.4, passHelmet: 0.35, carry2: 0.12, phone: 0.04, runRed: 0.08, wrongway: 0, speed: 0, alcohol: 0.22, noLic: 0.08, noCarryLic: 0.06, noCarryReg: 0.05, noIns: 0.1, vneid: 0.3 },
    react: { coop: 4, beg: 3, connect: 2, argue: 2, bribe: 1 }, flee: 0.06, accident: false,
    stars: [160, 340, 520]
  }
];

/* Chế độ tuần tra tự do: sinh ngẫu nhiên từ seed */
DATA.makeFreeShift = function (rand, daily) {
  const maps = ['city', 'highway', 'rural', 'industrial'];
  const lights = ['day', 'dusk', 'night'];
  const map = maps[Math.floor(rand() * maps.length)];
  const light = lights[Math.floor(rand() * lights.length)];
  const rain = rand() < 0.25;
  const times = { day: '09:00', dusk: '17:30', night: '21:30' };
  return {
    id: daily ? 'daily' : 'free', cpWait: 10,
    name: daily ? 'Thử thách hôm nay' : 'Tuần tra tự do',
    short: daily ? 'Thử thách hôm nay' : 'Tuần tra tự do',
    desc: 'Tình huống sinh ngẫu nhiên. Địa bàn: ' + MAP.NAMES[map] + '.',
    map: map, time: times[light], light: light, weather: rain ? 'rain' : 'clear', duration: 240,
    density: 0.9 + rand() * 0.4, mix: map === 'industrial' ? { moto: 0.68, car: 0.12, truck: 0.17, bus: 0.03 } : { moto: 0.68, car: 0.27, truck: 0.05 }, radar: map === 'highway' || rand() < 0.5, checkpoint: false,
    p: { helmet: 0.1, passenger: 0.33, passHelmet: 0.25, carry2: 0.06, phone: 0.06, runRed: map === 'highway' ? 0 : 0.08, wrongway: map === 'city' ? 0.25 : 0, overload: 0.3, oversize: 0.15, busOver: 0.4, speed: 0.15, alcohol: light === 'night' ? 0.15 : 0.05, noLic: 0.05, noCarryLic: 0.06, noCarryReg: 0.05, noIns: 0.08, vneid: 0.4 },
    react: { coop: 4, beg: 2, argue: 2, film: 1, connect: 1, bribe: 1 }, flee: 0.05, accident: map === 'city' && rand() < 0.5,
    stars: [150, 320, 500]
  };
};

/* ------------------------------ CẤP BẬC ------------------------------ */
DATA.RANKS = [
  { name: 'Hạ sĩ', xp: 0 },
  { name: 'Trung sĩ', xp: 500 },
  { name: 'Thượng sĩ', xp: 1200 },
  { name: 'Thiếu úy', xp: 2500 },
  { name: 'Trung úy', xp: 4000 },
  { name: 'Thượng úy', xp: 6000 },
  { name: 'Đại úy', xp: 9000 },
  { name: 'Thiếu tá', xp: 13000 }
];

/* ------------------------------ NHÂN VẬT ------------------------------ */
DATA.NAMES = {
  ho: ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'],
  demNam: ['Văn', 'Đức', 'Minh', 'Quang', 'Hữu', 'Công', 'Thành'],
  demNu: ['Thị', 'Ngọc', 'Thu', 'Thanh', 'Mai', 'Hồng'],
  tenNam: ['Hùng', 'Dũng', 'Tuấn', 'Nam', 'Long', 'Hải', 'Phong', 'Sơn', 'Khoa', 'Bình', 'Toàn', 'Việt', 'Quân'],
  tenNu: ['Lan', 'Hương', 'Hoa', 'Linh', 'Trang', 'Hạnh', 'Yến', 'Nga', 'Thảo', 'Vy']
};
DATA.PROVINCE_CODES = ['29', '30', '33', '34', '36', '37', '15', '17', '18', '20', '43', '51', '59', '61', '92'];

DATA.CAPTAIN = 'Thiếu tá Trần Minh (Đội trưởng)';

DATA.TUTORIAL_CP = [
  'Chào đồng chí! Tôi là Thiếu tá Trần Minh, Đội trưởng. Hôm nay đồng chí làm nhiệm vụ tại chốt kiểm soát cùng tổ công tác của tôi.',
  'Từng phương tiện sẽ vào chốt và dừng trước mặt đồng chí. Bảng quan sát phía dưới phóng to phương tiện: hãy xem kỹ mũ bảo hiểm, số người trên xe, điện thoại (chấm xanh sáng), tốc độ đo được và các tin báo.',
  'Có dấu hiệu vi phạm thì bấm DỪNG XE (phím SPACE). Không có vi phạm thì bấm CHO QUA (phím C). Hết thời gian quan sát, phương tiện sẽ tự đi tiếp.',
  'Khi làm việc: chào, thông báo lý do dừng xe, kiểm tra giấy tờ, đo nồng độ cồn nếu có dấu hiệu. Sau đó kết luận từng bằng chứng: đúng lỗi, đúng mức phạt.',
  'Người dân có thể xuất trình giấy tờ qua ứng dụng VNeID. Nếu thông tin hợp lệ thì coi như đã mang theo.',
  'Ca đầu tiên có gợi ý dấu hiệu vi phạm. Chúc đồng chí hoàn thành tốt nhiệm vụ!'
];

DATA.MODES = {
  cp: { name: 'Chốt kiểm soát', icon: '🚧', desc: 'Đứng chốt. Xe vào chốt lần lượt, phóng to để quan sát. Dễ tiếp cận.' },
  moto: { name: 'Tuần tra mô tô', icon: '🏍', desc: 'Tuần tra lưu động bằng mô tô trên phố. Xử lý vi phạm của xe mô tô, xe máy.' },
  car: { name: 'Tuần tra ô tô', icon: '🚓', desc: 'Tuần tra lưu động bằng ô tô trên quốc lộ. Chuyên đề: quá tải, quá khổ, xe khách, nồng độ cồn.' }
};

/* Hồ sơ chuyên đề cho tuần tra ô tô (ghép với giờ, thời tiết của ca) */
DATA.carPatrolShift = function (sh) {
  return Object.assign({}, sh, {
    map: sh.map === 'industrial' ? 'industrial' : 'highway', scope: 'car', radar: true, checkpoint: false,
    short: sh.short + ' · Ô tô',
    density: Math.max(0.9, sh.density * 0.9),
    mix: { moto: 0.3, car: 0.33, truck: 0.22, bus: 0.15 },
    p: Object.assign({}, sh.p, { alcohol: Math.max(0.15, sh.p.alcohol), speed: 0.15, overload: 0.4, oversize: 0.2, busOver: 0.45 }),
    accident: sh.accident
  });
};

DATA.TUTORIAL_MOTO = [
  'Chào đồng chí! Hôm nay đồng chí tuần tra lưu động bằng mô tô trên địa bàn, tập trung xử lý vi phạm của xe mô tô, xe máy.',
  'Điều khiển xe tuần tra: phím mũi tên hoặc W A S D. Trên điện thoại dùng cần điều khiển bên trái.'
];
DATA.TUTORIAL_CAR = [
  'Chào đồng chí! Hôm nay tổ công tác tuần tra lưu động bằng ô tô trên quốc lộ theo chuyên đề: xe quá tải, quá khổ, xe khách chở quá số người và nồng độ cồn.',
  'Điều khiển xe tuần tra: phím mũi tên hoặc W A S D. Trên điện thoại dùng cần điều khiển bên trái.',
  'Xe tải: dùng cân để kiểm tra tải trọng, đo chiều cao xếp hàng. Xe khách: kiểm đếm số người so với số chỗ ghi trong giấy chứng nhận kiểm định. Lưu ý: chở vượt khối lượng cho phép từ 10% trở xuống chưa bị xử phạt.'
];
DATA.TUTORIAL = [
  'Chào đồng chí! Tôi là Thiếu tá Trần Minh, Đội trưởng. Hôm nay đồng chí đi tuần cùng tổ công tác của tôi.',
  'Bám theo phương tiện, khung vàng sẽ khóa mục tiêu. Góc phải màn hình phóng to phương tiện để đồng chí quan sát: mũ bảo hiểm, số người trên xe, điện thoại... Xe có dấu hiệu vi phạm ở gần sẽ hiện biểu tượng ! màu vàng.',
  'Phát hiện vi phạm thì nhấn SPACE (hoặc nút DỪNG XE): còi hụ và loa yêu cầu phương tiện dừng vào lề. Chỉ dừng xe khi có căn cứ. Dừng xe tùy tiện sẽ bị trừ điểm.',
  'Khi làm việc: chào, thông báo lý do dừng xe, kiểm tra giấy tờ, xác định đúng lỗi, rồi mới xử lý. Luôn đúng quy trình và liêm chính!',
  'Người dân có thể xuất trình giấy tờ qua ứng dụng VNeID. Nếu thông tin hợp lệ thì coi như đã mang theo.',
  'Hết giờ ca sẽ có bảng tổng kết. Chúc đồng chí hoàn thành tốt nhiệm vụ!'
];

/* ------------------------------ TÌNH HUỐNG ỨNG XỬ ------------------------------ */
/* ok: đáp án đúng; release: chọn phương án này = cho đi, bỏ qua vi phạm; fail: vi phạm kỷ luật nghiêm trọng */
DATA.REACTIONS = {
  beg: {
    say: ['Anh ơi em đi gần đây thôi, anh bỏ qua cho em lần này nhé!', 'Em đang vội đón con, anh thông cảm cho em với ạ...', 'Lần đầu em bị, anh nhắc nhở thôi được không anh?'],
    options: [
      { t: 'Giải thích rõ lỗi vi phạm, mức phạt, tiếp tục làm việc theo quy định', ok: true, pts: 10, note: 'Cảm thông nhưng vẫn xử lý nghiêm, công bằng với mọi người.' },
      { t: 'Thông cảm, cho đi luôn', ok: false, pts: -30, release: true, note: 'Bỏ qua vi phạm là không đúng quy định, gây bất bình đẳng.' }
    ]
  },
  connect: {
    say: ['Anh biết anh Tư phòng CSGT không? Chú em đấy!', 'Để em gọi cho sếp anh một cuộc nhé.', 'Người nhà cả mà anh, nể nhau chút đi.'],
    options: [
      { t: 'Mọi người đều bình đẳng trước pháp luật. Mời anh/chị hợp tác để tổ công tác làm việc', ok: true, pts: 15, note: 'Không để quan hệ quen biết can thiệp vào việc thực thi công vụ.' },
      { t: 'Chờ người quen gọi điện rồi tính', ok: false, pts: -15, note: 'Không được để người khác can thiệp vào việc xử lý vi phạm.' },
      { t: 'Nể quen biết, cho đi', ok: false, pts: -30, release: true, note: 'Nể nang quan hệ là vi phạm quy định, làm mất uy tín lực lượng.' }
    ]
  },
  bribe: {
    say: ['(Người vi phạm kẹp tờ tiền vào giấy tờ xe) Anh cầm "uống nước" nhé, cho em đi...', '(Người vi phạm dúi phong bì) Chút lòng thành, anh bỏ qua cho em.'],
    options: [
      { t: 'Kiên quyết từ chối, cảnh báo đưa hối lộ là vi phạm pháp luật, tiếp tục xử lý', ok: true, pts: 30, integrity: true, note: 'Liêm chính là phẩm chất hàng đầu của người chiến sĩ CAND.' },
      { t: 'Nhận tiền, cho đi', ok: false, pts: 0, fail: true, note: 'Nhận hối lộ là hành vi phạm tội (Bộ luật Hình sự), vi phạm nghiêm trọng điều lệnh.' }
    ]
  },
  film: {
    say: ['(Người vi phạm giơ điện thoại quay video) Tôi quay lại hết đấy nhé!', '(Người đi đường dừng lại quay phim tổ công tác)'],
    options: [
      { t: 'Bình tĩnh, tiếp tục làm việc đúng quy trình, thái độ chuẩn mực', ok: true, pts: 10, note: 'Người dân có quyền giám sát. Làm đúng quy trình thì không có gì phải ngại.' },
      { t: 'Yêu cầu tắt máy, giằng lấy điện thoại', ok: false, pts: -20, note: 'Hành xử thiếu chuẩn mực, dễ gây phản cảm và khiếu nại.' }
    ]
  },
  argue: {
    say: ['Tôi có vi phạm gì đâu mà dừng xe tôi?', 'Bao nhiêu người cũng thế sao anh chỉ bắt mình tôi?'],
    options: [
      { t: 'Ôn tồn giải thích hành vi vi phạm, căn cứ pháp luật; cho xem hình ảnh/thiết bị ghi nhận nếu có', ok: true, pts: 10, note: 'Giải thích rõ ràng, có căn cứ giúp người dân hiểu và chấp hành.' },
      { t: 'Lớn tiếng tranh cãi tay đôi', ok: false, pts: -15, note: 'Tranh cãi làm mất hình ảnh người chiến sĩ CSGT.' }
    ]
  }
};

DATA.GREETINGS = [
  { t: 'Chào theo điều lệnh, tự giới thiệu, thông báo lý do dừng xe', ok: true, pts: 10, note: 'Đúng quy trình: chào, thông báo lý do dừng phương tiện.' },
  { t: 'Yêu cầu xuất trình giấy tờ ngay', ok: false, pts: -5, note: 'Thiếu bước chào và thông báo lý do dừng phương tiện.' },
  { t: 'Quát: "Tấp vào! Giấy tờ đâu?"', ok: false, pts: -15, note: 'Thái độ thiếu chuẩn mực khi tiếp xúc với nhân dân.' }
];

DATA.FLEE = {
  say: 'Phương tiện không chấp hành hiệu lệnh, tăng ga bỏ chạy!',
  options: [
    { t: 'Ghi nhận biển số, đặc điểm; thông báo cho tổ công tác phía trước và trung tâm chỉ huy', ok: true, pts: 15, note: 'Đảm bảo an toàn cho người dân và cán bộ, vẫn xử lý được vi phạm.' },
    { t: 'Truy đuổi bằng mọi giá', ok: false, pts: -15, note: 'Truy đuổi nguy hiểm có thể gây tai nạn cho người đi đường.' }
  ]
};

DATA.ACCIDENT = [
  {
    q: 'Đến hiện trường vụ va chạm giữa hai phương tiện. Việc cần làm ĐẦU TIÊN là gì?',
    options: [
      { t: 'Đặt cảnh báo, phân luồng, bảo vệ hiện trường và kiểm tra tình trạng người bị nạn', ok: true },
      { t: 'Kéo ngay hai xe vào lề cho thông đường', ok: false, note: 'Làm thay đổi hiện trường khi chưa ghi nhận.' },
      { t: 'Chụp ảnh đăng mạng xã hội cảnh báo mọi người', ok: false, note: 'Không phải việc của tổ công tác, có thể lộ thông tin cá nhân.' }
    ]
  },
  {
    q: 'Một người bị thương chảy máu ở chân, còn tỉnh, kêu đau cổ. Xử lý thế nào?',
    options: [
      { t: 'Gọi cấp cứu 115, sơ cứu cầm máu, không tự ý di chuyển nạn nhân khi nghi chấn thương cột sống', ok: true },
      { t: 'Đỡ nạn nhân ngồi dậy, cho uống nước', ok: false, note: 'Có thể làm chấn thương cột sống nặng thêm.' },
      { t: 'Chờ xe cứu thương, không làm gì', ok: false, note: 'Cần sơ cứu ban đầu kịp thời.' }
    ]
  },
  {
    q: 'Sau khi đã đảm bảo an toàn và cấp cứu, bước tiếp theo?',
    options: [
      { t: 'Ghi nhận hiện trường, thông tin người liên quan, nhân chứng; kiểm tra nồng độ cồn người điều khiển; báo cáo đơn vị', ok: true },
      { t: 'Để hai bên tự thỏa thuận rồi giải tán', ok: false, note: 'Tổ công tác phải ghi nhận, giải quyết theo quy định.' },
      { t: 'Cho các lái xe về trước, hôm sau lên làm việc', ok: false, note: 'Có thể mất chứng cứ, bỏ sót vi phạm.' }
    ]
  }
];

DATA.TIPS = [
  'Người ngồi sau không đội mũ bảo hiểm: người điều khiển xe bị xử phạt (trừ trường hợp chở người bệnh đi cấp cứu, trẻ em dưới 06 tuổi, áp giải người vi phạm pháp luật).',
  'GPLX xuất trình qua ứng dụng VNeID có giá trị như bản giấy.',
  'Không mang theo GPLX khác với không có GPLX. Hãy tra cứu cơ sở dữ liệu để phân biệt.',
  'Luật TTATGTĐB 2024 nghiêm cấm điều khiển phương tiện mà trong máu hoặc hơi thở có nồng độ cồn.',
  'Tại chốt kiểm soát theo kế hoạch, tổ công tác được dừng phương tiện để kiểm tra.',
  'Tổng mức phạt khi vi phạm nhiều lỗi được cộng theo từng hành vi.'
];

/* ------------------------------ TÌNH HUỐNG ĐẶC BIỆT ------------------------------ */
/* Mỗi câu: q = câu hỏi; options: ok = đáp án đúng; note = giải thích khi chọn sai */
DATA.EVENT_INFO = {
  accident: { icon: '🚑', name: 'Tai nạn giao thông' },
  snatch: { icon: '🦹', name: 'Cướp giật tài sản' },
  wanted: { icon: '🚨', name: 'Đối tượng truy nã' },
  race: { icon: '🏍', name: 'Đua xe trái phép' },
  help: { icon: '🤝', name: 'Hỗ trợ nhân dân' }
};

DATA.EVENT_Q = {
  accident_truck: {
    q: 'Xe tải lật, hàng hóa đổ tràn mặt đường, giao thông ùn ứ. Ưu tiên xử lý thế nào?',
    options: [
      { t: 'Đặt cảnh báo từ xa, phân luồng, cứu người bị nạn, phối hợp đơn vị chức năng cẩu kéo, thu dọn hàng hóa', ok: true },
      { t: 'Cho người dân tự do nhặt hàng để nhanh thông đường', ok: false, note: 'Gây mất an toàn, xâm phạm tài sản, làm thay đổi hiện trường.' },
      { t: 'Chờ chủ xe đến tự xử lý', ok: false, note: 'Tổ công tác phải chủ động bảo đảm an toàn, phân luồng ngay.' }
    ]
  },
  accident_fall: {
    q: 'Một người đi xe máy tự ngã, hơi thở có mùi rượu bia, bị trầy xước. Xử lý thế nào?',
    options: [
      { t: 'Sơ cứu, gọi cấp cứu nếu cần; kiểm tra nồng độ cồn; đưa phương tiện vào lề bảo đảm an toàn', ok: true },
      { t: 'Để người đó tự đi về vì chỉ bị nhẹ', ok: false, note: 'Có dấu hiệu sử dụng rượu bia: cần kiểm tra, không để tiếp tục điều khiển xe.' },
      { t: 'Lập biên bản ngay, chưa cần sơ cứu', ok: false, note: 'Ưu tiên cứu người trước.' }
    ]
  },
  snatch1: {
    q: 'Có người hô cướp! Đối tượng đi xe máy bỏ chạy. Đồng chí xử lý thế nào?',
    options: [
      { t: 'Bám theo ở khoảng cách an toàn, báo trung tâm chỉ huy, phối hợp lực lượng chặn bắt ở nơi vắng người', ok: true },
      { t: 'Tông thẳng vào xe đối tượng để ép ngã', ok: false, note: 'Hành động nguy hiểm cho người đi đường và cán bộ.' },
      { t: 'Bỏ qua vì đây không phải nhiệm vụ của CSGT', ok: false, note: 'CSGT có trách nhiệm phối hợp phòng, chống tội phạm trên tuyến.' }
    ]
  },
  snatch1_cp: {
    q: 'Đối tượng cướp giật đang chạy xe máy về phía chốt. Đồng chí xử lý thế nào?',
    options: [
      { t: 'Triển khai rào chắn từ xa, chặn ở vị trí an toàn, phối hợp khống chế đối tượng', ok: true },
      { t: 'Đứng ra giữa đường dang tay chặn', ok: false, note: 'Rất nguy hiểm, đối tượng có thể tông vào cán bộ.' },
      { t: 'Né sang bên cho đối tượng đi qua rồi bỏ qua', ok: false, note: 'Bỏ lọt tội phạm.' }
    ]
  },
  snatch2: {
    q: 'Đã khống chế được đối tượng cướp giật cùng tang vật. Bước tiếp theo?',
    options: [
      { t: 'Thu giữ tang vật, lập biên bản bắt người phạm tội quả tang, bàn giao cho cơ quan Công an có thẩm quyền', ok: true },
      { t: 'Trả lại túi cho bị hại rồi thả đối tượng', ok: false, note: 'Phải bàn giao đối tượng để xử lý theo pháp luật.' },
      { t: 'Đánh đối tượng để răn đe', ok: false, note: 'Nghiêm cấm xâm phạm thân thể người bị bắt.' }
    ]
  },
  wanted1: {
    q: 'Đối chiếu căn cước: người điều khiển đúng là đối tượng đang bị truy nã. Đồng chí làm gì?',
    options: [
      { t: 'Bình tĩnh, giữ khoảng cách an toàn, yêu cầu hỗ trợ, khống chế khi đủ lực lượng, tránh để đối tượng bỏ chạy', ok: true },
      { t: 'Hô to tên đối tượng để xác nhận', ok: false, note: 'Dễ khiến đối tượng manh động, bỏ chạy.' },
      { t: 'Để đối tượng đi, cuối ca mới báo cáo', ok: false, note: 'Bỏ lọt đối tượng truy nã.' }
    ]
  },
  wanted2: {
    q: 'Sau khi bắt giữ đối tượng truy nã, cần làm gì?',
    options: [
      { t: 'Lập biên bản bắt người đang bị truy nã, bàn giao ngay cho cơ quan Công an có thẩm quyền', ok: true },
      { t: 'Tự lấy lời khai và xử lý tại chỗ', ok: false, note: 'Không đúng thẩm quyền, thủ tục.' },
      { t: 'Đưa đối tượng về nhà để gia đình quản lý', ok: false, note: 'Sai quy định.' }
    ]
  },
  race1: {
    q: 'Phát hiện nhóm thanh niên đua xe trái phép, lạng lách. Đồng chí xử lý thế nào?',
    options: [
      { t: 'Không truy đuổi nguy hiểm; ghi hình, ghi biển số, báo trung tâm phối hợp chặn ở điểm phù hợp', ok: true },
      { t: 'Tăng tốc rượt đuổi sát nút', ok: false, note: 'Dễ gây tai nạn cho người đua xe và người đi đường.' },
      { t: 'Ném vật cản ra đường', ok: false, note: 'Hành vi nguy hiểm, trái quy định.' }
    ]
  },
  race2: {
    q: 'Các đối tượng đua xe đã bị dừng lại, nhiều em chưa đủ 18 tuổi. Bước tiếp theo?',
    options: [
      { t: 'Lập biên bản, xử lý theo quy định; thông báo gia đình, nhà trường đối với người chưa thành niên', ok: true },
      { t: 'Nhắc nhở rồi cho đi vì còn nhỏ tuổi', ok: false, note: 'Đua xe trái phép là vi phạm nghiêm trọng, phải xử lý.' },
      { t: 'Tịch thu điện thoại của các em', ok: false, note: 'Không có căn cứ.' }
    ]
  },
  help_amb: {
    q: 'Xe cấp cứu đang chở bệnh nhân bị kẹt giữa dòng xe. Đồng chí làm gì?',
    options: [
      { t: 'Bật đèn, còi ưu tiên, đi trước mở đường, hướng dẫn các phương tiện nhường đường', ok: true },
      { t: 'Bảo xe cấp cứu chờ đến khi đường thông', ok: false, note: 'Xe cấp cứu đang làm nhiệm vụ được quyền ưu tiên.' },
      { t: 'Đi phía sau xe cấp cứu', ok: false, note: 'Cần chủ động mở đường phía trước.' }
    ]
  },
  help_break: {
    q: 'Một ô tô chết máy giữa làn đường, tài xế lúng túng. Đồng chí làm gì?',
    options: [
      { t: 'Bật đèn cảnh báo, đặt nón cảnh báo phía sau, hỗ trợ đưa xe vào lề, hướng dẫn liên hệ cứu hộ', ok: true },
      { t: 'Lập biên bản vì dừng xe giữa đường', ok: false, note: 'Xe gặp sự cố bất khả kháng: cần hỗ trợ bảo đảm an toàn.' },
      { t: 'Bỏ đi vì không phải việc của CSGT', ok: false, note: 'Hỗ trợ người dân là trách nhiệm của tổ công tác.' }
    ]
  },
  help_child: {
    q: 'Một cháu bé đứng khóc bên đường, bị lạc người thân. Đồng chí làm gì?',
    options: [
      { t: 'Trấn an, hỏi thông tin, đưa cháu về trụ sở Công an gần nhất và liên hệ gia đình', ok: true },
      { t: 'Chỉ đường cho cháu tự về', ok: false, note: 'Trẻ nhỏ không thể tự về an toàn.' },
      { t: 'Đưa cháu lên xe đi tìm khắp nơi, không báo ai', ok: false, note: 'Cần thông báo đơn vị để phối hợp tìm gia đình.' }
    ]
  },
  help_old: {
    q: 'Một cụ già muốn qua đường đông xe. Đồng chí làm gì?',
    options: [
      { t: 'Ra hiệu cho các phương tiện dừng lại, dìu cụ qua đường an toàn', ok: true },
      { t: 'Bảo cụ đợi lúc vắng xe rồi tự đi', ok: false, note: 'Người cao tuổi cần được hỗ trợ.' },
      { t: 'Chỉ cụ đi bộ ra nút giao xa phía trước', ok: false, note: 'Chưa hỗ trợ kịp thời.' }
    ]
  }
};

/* Lịch tình huống của từng ca: trọng số các loại + số lượng */
DATA.SHIFT_EVENTS = {
  1: { w: { help: 3, accident: 1 }, n: 2 },
  2: { w: { snatch: 2, race: 1, help: 1, accident: 1 }, n: 2 },
  3: { w: { wanted: 2, race: 2, accident: 1 }, n: 2 },
  4: { w: { accident: 2, wanted: 1, race: 1, help: 1 }, n: 2 },
  5: { w: { accident: 2, snatch: 1, wanted: 1, help: 1 }, n: 3 },
  6: { w: { accident: 2, help: 1, snatch: 1, wanted: 1 }, n: 3 },
  7: { w: { help: 2, race: 2, wanted: 1, accident: 1 }, n: 3 },
  free: { w: { accident: 1, snatch: 1, wanted: 1, race: 1, help: 1 }, n: 3 }
};
