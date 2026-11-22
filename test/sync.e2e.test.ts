// Chạy code đồng bộ thật của app với server thật, giả lập hai máy dùng chung một tài khoản.
// Cần server dev đang chạy (repo ../salary, có MongoDB replica set) tại EXPO_PUBLIC_API_URL
// (mặc định http://localhost:3000). Không kết nối được thì cả file tự bỏ qua.
//   pnpm test:e2e
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

process.env.EXPO_PUBLIC_API_URL ??= 'http://localhost:3000';
const API = process.env.EXPO_PUBLIC_API_URL;

const reachable = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2_000) })
  .then((r) => r.ok)
  .catch(() => false);

const { api, authed } = await import('../src/api/client.ts');
const { clearSession, useSession } = await import('../src/api/session.ts');
const actions = await import('../src/data/actions.ts');
const { DEFAULT_SETTINGS, DEFAULT_SYNC_META } = await import('../src/data/types.ts');
const { getData, useDataStore, writeWorkDays } = await import('../src/data/store.ts');
const { deleteAccount, signInDev, signOut } = await import('../src/sync/account.ts');
const { syncNow } = await import('../src/sync/engine.ts');

const hours = (x1: number) => ({ x1, x1_5: 0, x2: 0, x2_5: 0, x3: 0 });
const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => r.deletedAt === null);
const dirtyCount = () => {
  const s = getData();
  return [...s.jobs, ...s.workDays, ...s.weeklyPays].filter((r) => r.dirty).length;
};

/** Máy mới: dữ liệu trên máy trống, chưa đăng nhập */
async function freshDevice() {
  await clearSession();
  useDataStore.setState({
    ready: false, jobs: [], workDays: [], weeklyPays: [], settings: DEFAULT_SETTINGS, rulesCache: {}, sync: DEFAULT_SYNC_META,
  });
  await actions.initData();
}

describe('Đồng bộ hai máy với server thật', { skip: reachable ? false : `Không kết nối được ${API}` }, () => {
  const name = `e2e-${randomUUID().slice(0, 8)}`;
  let deviceA: ReturnType<typeof getData>;
  let jobA = '';

  before(async () => {
    await freshDevice();
  });
  after(async () => {
    // Dọn dữ liệu test trên server
    if (useSession.getState().status === 'signedIn') await deleteAccount().catch(() => {});
  });

  test('máy A: dùng khi chưa đăng nhập, đăng nhập lần đầu thì đẩy hết lên server', async () => {
    jobA = getData().settings.activeJobId!;
    assert.equal(actions.saveDay('2026-11-17', { hours: hours(8), allowance: 0 }).ok, true);
    actions.setWeeklyPay('2026-11-16', 30_960);
    actions.updateSettings({ deductRate: 3.3 });
    assert.ok(dirtyCount() >= 3);

    await signInDev(name);
    assert.equal(useSession.getState().status, 'signedIn');
    assert.equal(dirtyCount(), 0);
    assert.equal(getData().settings.settingsDirty, false);
    assert.deepEqual(getData().sync.rejections, []);
    assert.ok(getData().sync.since);

    const month = await authed(() => api.GET('/v1/work-days', { params: { query: { month: '2026-11', jobId: jobA } } }));
    assert.equal(month.items.length, 1);
    assert.equal(month.summary.total, 82_560 + 30_960);
    const me = await authed(() => api.GET('/v1/me'));
    assert.equal(me.settings?.deductRate, 3.3);
    deviceA = structuredClone(getData());
  });

  test('máy B: đăng nhập cùng tài khoản thì nhận dữ liệu và tự chọn nơi làm có dữ liệu', async () => {
    await freshDevice();
    const emptyJobB = getData().settings.activeJobId;
    assert.notEqual(emptyJobB, jobA);

    await signInDev(name);
    const s = getData();
    assert.equal(s.settings.activeJobId, jobA, 'chuyển sang nơi làm của máy A');
    assert.deepEqual(alive(s.workDays).map((d) => d.date), ['2026-11-17']);
    assert.equal(alive(s.weeklyPays)[0]?.amount, 30_960);
    assert.equal(s.settings.deductRate, 3.3);
    assert.equal(dirtyCount(), 0);
  });

  test('bản sửa mới nhất thắng: máy A sửa offline từ trước, đồng bộ sau thì nhận bản của máy B', async () => {
    const editedBefore = new Date(Date.now() - 60_000).toISOString();
    assert.equal(actions.saveDay('2026-11-17', { hours: hours(8), allowance: 5_000 }).ok, true);
    actions.saveDay('2026-11-18', { hours: hours(6), allowance: 0 });
    await syncNow();
    assert.equal(dirtyCount(), 0);
    const deviceB = structuredClone(getData());

    // Quay lại máy A, sửa cùng ngày nhưng thời điểm sửa sớm hơn bản của máy B
    useDataStore.setState(deviceA);
    const a17 = alive(getData().workDays).find((d) => d.date === '2026-11-17')!;
    writeWorkDays([{ ...a17, allowance: 9_999, updatedAt: editedBefore, dirty: true }]);
    await syncNow();
    const now17 = alive(getData().workDays).find((d) => d.date === '2026-11-17')!;
    assert.equal(now17.allowance, 5_000, 'giữ bản mới hơn của máy B');
    assert.equal(now17.dirty, false);
    assert.ok(alive(getData().workDays).some((d) => d.date === '2026-11-18'), 'nhận ngày 18 máy B thêm');
    deviceA = structuredClone(getData());
    void deviceB;
  });

  test('trùng ngày (tạo trên hai máy khi offline) bị từ chối, chọn giữ bản server thì hết lỗi', async () => {
    writeWorkDays([{
      id: randomUUID(), jobId: jobA, date: '2026-11-18', hours: hours(4), allowance: 0, wageSnapshot: 10_320,
      updatedAt: new Date().toISOString(), deletedAt: null, dirty: true,
    }]);
    await syncNow();
    assert.deepEqual(getData().sync.rejections.map((r) => r.code), ['duplicate_day']);

    actions.discardRejected();
    await syncNow();
    assert.deepEqual(getData().sync.rejections, []);
    assert.equal(dirtyCount(), 0);
    const days18 = alive(getData().workDays).filter((d) => d.date === '2026-11-18');
    assert.equal(days18.length, 1);
    assert.equal(days18[0]!.hours.x1, 6, 'còn lại bản của máy B');
  });

  test('bản trỏ tới nơi làm không tồn tại (unknown_job) bỏ được, không kẹt cảnh báo', async () => {
    // Gặp thật trên máy ảo: ngày công ghi được nhưng nơi làm của nó ghi thất bại (SQLite bị khóa)
    writeWorkDays([{
      id: randomUUID(), jobId: randomUUID(), date: '2026-11-20', hours: hours(8), allowance: 0, wageSnapshot: 10_320,
      updatedAt: new Date().toISOString(), deletedAt: null, dirty: true,
    }]);
    await syncNow();
    assert.deepEqual(getData().sync.rejections.map((r) => r.code), ['unknown_job']);

    actions.discardRejected();
    await syncNow();
    assert.deepEqual(getData().sync.rejections, []);
    assert.equal(dirtyCount(), 0);
    assert.ok(getData().sync.since, 'đã kéo lại toàn bộ và có mốc mới');
  });

  test('cài đặt: máy này đổi mức khấu trừ thì máy kia nhận được', async () => {
    actions.updateSettings({ deductRate: 9.4 });
    await syncNow();
    assert.equal((await authed(() => api.GET('/v1/me'))).settings?.deductRate, 9.4);
  });

  test('xóa nơi làm xóa luôn ngày công của nó trên server', async () => {
    const r = actions.addJob('Nhà máy B', 11_000);
    assert.equal(r.ok, true);
    const jobB = getData().settings.activeJobId!;
    actions.saveDay('2026-11-19', { hours: hours(8), allowance: 0 });
    await syncNow();
    assert.equal(actions.deleteJob(jobB).ok, true);
    await syncNow();
    const jobs = await authed(() => api.GET('/v1/jobs'));
    assert.ok(!jobs.items.some((j) => j.id === jobB));
    const month = await authed(() => api.GET('/v1/work-days', { params: { query: { month: '2026-11', jobId: jobB } } }));
    assert.equal(month.items.length, 0);
    assert.equal(getData().settings.activeJobId, jobA);
  });

  test('đăng xuất giữ dữ liệu trên máy; đăng nhập lại không tạo bản trùng', async () => {
    const before = alive(getData().workDays).length;
    await signOut();
    assert.equal(useSession.getState().status, 'signedOut');
    assert.equal(alive(getData().workDays).length, before);
    await signInDev(name);
    assert.deepEqual(getData().sync.rejections, []);
    assert.equal(alive(getData().workDays).length, before);
  });
});
