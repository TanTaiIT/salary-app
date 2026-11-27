import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addHoliday,
  draftForNewYear,
  draftFromRules,
  isDirty,
  nextYear,
  parseDayMonth,
  parseDecimal,
  summarizeChange,
  validateDraft,
} from '@/data/admin-rules';

const rules2026 = {
  minimumWage: 10_320,
  weeklyHoliday: { minHours: 15, maxHours: 40, paidHours: 8 },
  holidays: [
    { date: '2026-12-25', name: 'Giáng sinh' },
    { date: '2026-01-01', name: 'Năm mới' },
  ],
};

describe('Bản nháp quy định năm', () => {
  test('từ quy định đã có: tiền có dấu chấm, ngày lễ sắp theo ngày', () => {
    const d = draftFromRules(rules2026);
    assert.equal(d.minimumWage, '10.320');
    assert.equal(d.minHours, '15');
    assert.deepEqual(d.holidays.map((h) => h.date), ['2026-01-01', '2026-12-25']);
  });

  test('năm mới chép lương và điều kiện 주휴수당 của năm gần nhất, ngày lễ trống', () => {
    const d = draftForNewYear(rules2026);
    assert.equal(d.minimumWage, '10.320');
    assert.equal(d.paidHours, '8');
    assert.deepEqual(d.holidays, []);
  });

  test('năm gợi ý: sau năm lớn nhất, hoặc năm hiện tại khi chưa có', () => {
    assert.equal(nextYear([2026, 2025], 2026), 2027);
    assert.equal(nextYear([], 2026), 2026);
  });

  test('isDirty phát hiện sửa', () => {
    const d = draftFromRules(rules2026);
    assert.equal(isDirty(d, draftFromRules(rules2026)), false);
    assert.equal(isDirty({ ...d, minimumWage: '10.500' }, d), true);
  });
});

describe('Nhập liệu', () => {
  test('số thập phân nhận cả dấu phẩy', () => {
    assert.equal(parseDecimal('7,5'), 7.5);
    assert.equal(parseDecimal('40'), 40);
    assert.ok(Number.isNaN(parseDecimal('')));
    assert.ok(Number.isNaN(parseDecimal('abc')));
  });

  test('ngày/tháng theo năm đang sửa', () => {
    assert.equal(parseDayMonth('1/1', 2027), '2027-01-01');
    assert.equal(parseDayMonth('25.12', 2027), '2027-12-25');
    assert.equal(parseDayMonth('9-10', 2027), '2027-10-09');
    assert.equal(parseDayMonth('30/2', 2027), null);
    assert.equal(parseDayMonth('2027-01-01', 2027), null);
  });

  test('thêm ngày lễ: sắp xếp, chặn trùng ngày, ngày sai, tên trống', () => {
    const r = addHoliday([{ date: '2027-12-25', name: 'Giáng sinh' }], '1/1', ' Năm mới ', 2027);
    assert.ok(r.ok);
    assert.deepEqual(r.holidays, [
      { date: '2027-01-01', name: 'Năm mới' },
      { date: '2027-12-25', name: 'Giáng sinh' },
    ]);
    assert.equal(addHoliday(r.holidays, '25/12', 'Trùng', 2027).ok, false);
    assert.equal(addHoliday([], '32/1', 'Sai', 2027).ok, false);
    assert.equal(addHoliday([], '1/1', '  ', 2027).ok, false);
  });
});

describe('Kiểm tra trước khi lưu', () => {
  test('bản hợp lệ trả đúng dữ liệu gửi server', () => {
    const v = validateDraft(2026, draftFromRules(rules2026));
    assert.ok(v.ok);
    assert.equal(v.input.minimumWage, 10_320);
    assert.deepEqual(v.input.weeklyHoliday, { minHours: 15, maxHours: 40, paidHours: 8 });
  });

  test('lương trống hoặc 0, giờ sai, min lớn hơn max đều báo lỗi đúng ô', () => {
    const base = draftFromRules(rules2026);
    const v1 = validateDraft(2026, { ...base, minimumWage: '' });
    assert.ok(!v1.ok && v1.errors.minimumWage);
    const v2 = validateDraft(2026, { ...base, minimumWage: '0' });
    assert.ok(!v2.ok && v2.errors.minimumWage);
    const v3 = validateDraft(2026, { ...base, paidHours: '30' });
    assert.ok(!v3.ok && v3.errors.paidHours);
    const v4 = validateDraft(2026, { ...base, minHours: '41' });
    assert.ok(!v4.ok && v4.errors.minHours === 'minHours không được lớn hơn maxHours');
  });

  test('ngày lễ khác năm hoặc trùng ngày bị chặn', () => {
    const base = draftFromRules(rules2026);
    const v1 = validateDraft(2027, base);
    assert.ok(!v1.ok && v1.errors.holidays?.includes('không thuộc năm 2027'));
    const v2 = validateDraft(2026, { ...base, holidays: [...base.holidays, { date: '2026-01-01', name: 'Trùng' }] });
    assert.ok(!v2.ok && v2.errors.holidays?.includes('bị trùng'));
  });
});

describe('Tóm tắt nhật ký', () => {
  test('tạo mới', () => {
    const lines = summarizeChange(null, { ...rules2026, _id: '2026', year: 2026 });
    assert.match(lines[0]!, /Tạo mới: lương tối thiểu 10\.320 ₩, 2 ngày lễ/);
  });

  test('sửa lương, điều kiện, thêm và bỏ ngày lễ', () => {
    const after = {
      ...rules2026,
      minimumWage: 10_500,
      weeklyHoliday: { minHours: 15, maxHours: 40, paidHours: 7.5 },
      holidays: [
        { date: '2026-01-01', name: 'Năm mới' },
        { date: '2026-10-09', name: 'Ngày Hangul' },
      ],
    };
    assert.deepEqual(summarizeChange(rules2026, after), [
      'Lương tối thiểu: 10.320 → 10.500 ₩',
      '주휴수당: từ 15 giờ, tính tối đa 40 giờ, trả 8 giờ → từ 15 giờ, tính tối đa 40 giờ, trả 7,5 giờ',
      'Thêm ngày lễ: 9/10 Ngày Hangul',
      'Bỏ ngày lễ: 25/12 Giáng sinh',
    ]);
  });

  test('dữ liệu lạ không làm vỡ màn hình', () => {
    assert.deepEqual(summarizeChange(null, 'x'), ['Không đọc được nội dung thay đổi']);
    assert.deepEqual(summarizeChange(rules2026, rules2026), ['Lưu lại, không đổi nội dung']);
  });
});
