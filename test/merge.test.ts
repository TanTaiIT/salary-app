import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Job, Settings, WorkDayRecord } from '../src/data/types.ts';
import { applyResults, mergeRemote, mergeSettings, pickActiveJob, pickDirty } from '../src/sync/merge.ts';

const hours = { x1: 8, x1_5: 0, x2: 0, x2_5: 0, x3: 0 };
const day = (id: string, updatedAt: string, dirty: boolean, extra: Partial<WorkDayRecord> = {}): WorkDayRecord => ({
  id,
  jobId: 'job-a',
  date: '2026-11-17',
  hours,
  allowance: 0,
  wageSnapshot: 10_320,
  updatedAt,
  deletedAt: null,
  dirty,
  ...extra,
});
const T1 = '2026-11-20T10:00:00.000Z';
const T2 = '2026-11-20T11:00:00.000Z';
const T3 = '2026-11-20T12:00:00.000Z';

describe('Gửi lên', () => {
  test('chỉ lấy bản chưa đồng bộ, tối đa 500, bỏ bản đã bị từ chối', () => {
    const rows = Array.from({ length: 600 }, (_, i) => day(`d${i}`, T1, i !== 0));
    const picked = pickDirty(rows, new Set(['d1']));
    assert.equal(picked.length, 500);
    assert.ok(!picked.some((r) => r.id === 'd0' || r.id === 'd1'));
  });
});

describe('Kết quả server', () => {
  test('applied và stale bỏ dấu chưa đồng bộ; rejected giữ lại kèm lý do', () => {
    const sent = [day('a', T1, true), day('b', T1, true), day('c', T1, true)];
    const r = applyResults('workDay', sent, sent, [
      { id: 'a', status: 'applied' },
      { id: 'b', status: 'stale' },
      { id: 'c', status: 'rejected', code: 'duplicate_day' },
    ]);
    assert.deepEqual(r.clean.map((x) => [x.id, x.dirty]), [['a', false], ['b', false]]);
    assert.deepEqual(r.rejections, [{ kind: 'workDay', id: 'c', code: 'duplicate_day' }]);
  });

  test('người dùng sửa tiếp trong lúc chờ server thì vẫn giữ dấu chưa đồng bộ', () => {
    const sent = [day('a', T1, true)];
    const current = [day('a', T2, true, { allowance: 5_000 })];
    assert.deepEqual(applyResults('workDay', current, sent, [{ id: 'a', status: 'applied' }]).clean, []);
  });
});

describe('Kéo về', () => {
  test('bản mới từ server được thêm, bản server mới hơn đè bản trên máy', () => {
    const current = [day('a', T1, false), day('b', T1, true)];
    const remote = [day('a', T2, false, { allowance: 1 }), day('b', T2, false, { allowance: 2 }), day('c', T1, false)];
    const out = mergeRemote(current, remote);
    assert.deepEqual(out.map((x) => [x.id, x.allowance, x.dirty]), [['a', 1, false], ['b', 2, false], ['c', 0, false]]);
  });

  test('bản trên máy chưa gửi và mới hơn thì giữ', () => {
    const out = mergeRemote([day('a', T3, true, { allowance: 9 })], [day('a', T2, false)]);
    assert.deepEqual(out, []);
  });

  test('bản giống hệt đã có thì không ghi lại; việc xóa từ máy khác được nhận', () => {
    assert.deepEqual(mergeRemote([day('a', T1, false)], [day('a', T1, false)]), []);
    const out = mergeRemote([day('a', T1, false)], [day('a', T2, false, { deletedAt: T2 })]);
    assert.equal(out[0]!.deletedAt, T2);
  });
});

describe('Cài đặt', () => {
  const base: Settings = {
    activeJobId: 'job-a',
    deductRate: 3.3,
    deductRateUpdatedAt: T2,
    settingsDirty: true,
    theme: 'auto',
    firstOpenAt: null,
  };

  test('bản vừa gửi được server nhận thì bỏ dấu chưa đồng bộ', () => {
    assert.deepEqual(mergeSettings(base, T2, 'applied', { deductRate: 3.3, updatedAt: T2 }), {
      deductRate: 3.3,
      deductRateUpdatedAt: T2,
      settingsDirty: false,
    });
  });

  test('máy khác sửa sau: bản server thắng (stale)', () => {
    assert.deepEqual(mergeSettings(base, T2, 'stale', { deductRate: 9.4, updatedAt: T3 }), {
      deductRate: 9.4,
      deductRateUpdatedAt: T3,
      settingsDirty: false,
    });
  });

  test('máy này sửa sau khi gửi: giữ bản trên máy, vẫn chờ gửi', () => {
    const local = { ...base, deductRate: 0, deductRateUpdatedAt: T3 };
    assert.equal(mergeSettings(local, T2, 'applied', { deductRate: 3.3, updatedAt: T2 }), null);
  });

  test('chưa từng đổi trên máy: nhận bản server', () => {
    const local = { ...base, deductRate: 0, deductRateUpdatedAt: null, settingsDirty: false };
    assert.deepEqual(mergeSettings(local, null, null, { deductRate: 9.4, updatedAt: T1 }), {
      deductRate: 9.4,
      deductRateUpdatedAt: T1,
      settingsDirty: false,
    });
  });
});

describe('Chọn nơi làm sau lần đồng bộ đầu', () => {
  const job = (id: string, deletedAt: string | null = null): Job => ({
    id, name: id, hourlyWage: 10_320, companySize: '5plus', updatedAt: T1, deletedAt, dirty: false,
  });

  test('nơi làm mặc định rỗng thì chuyển sang nơi làm có dữ liệu kéo về', () => {
    const days = [day('1', T1, false, { jobId: 'remote' }), day('2', T1, false, { jobId: 'remote' })];
    assert.equal(pickActiveJob('local', [job('local'), job('remote')], days), 'remote');
  });

  test('nơi làm đang chọn có dữ liệu thì giữ nguyên', () => {
    const days = [day('1', T1, false, { jobId: 'local' }), day('2', T1, false, { jobId: 'remote' }), day('3', T1, false, { jobId: 'remote' })];
    assert.equal(pickActiveJob('local', [job('local'), job('remote')], days), 'local');
  });

  test('không nơi nào có dữ liệu thì giữ nơi đang chọn; nơi đang chọn đã xóa thì chọn nơi còn lại', () => {
    assert.equal(pickActiveJob('local', [job('local'), job('remote')], []), 'local');
    assert.equal(pickActiveJob('gone', [job('gone', T2), job('remote')], []), 'remote');
  });
});
