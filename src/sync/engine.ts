// Bộ máy đồng bộ: gửi các bản chưa đồng bộ lên POST /v1/sync, áp kết quả, gộp dữ liệu kéo về.
// Chỉ một lần đồng bộ chạy tại một thời điểm; lần gọi trong lúc đang chạy sẽ được chạy tiếp ngay sau.
import { create } from 'zustand';

import { api, authed, ApiError } from '@/api/client';
import { useSession } from '@/api/session';
import { getData, writeJobs, writeSettings, writeSyncMeta, writeWeeklyPays, writeWorkDays } from '@/data/store';
import type { SyncRejection } from '@/data/types';

import {
  applyResults,
  jobFromApi,
  jobToChange,
  mergeRemote,
  mergeSettings,
  pickActiveJob,
  pickDirty,
  weeklyFromApi,
  weeklyToChange,
  workDayFromApi,
  workDayToChange,
} from './merge';

/** Giới hạn số vòng mỗi lần đồng bộ (mỗi vòng ≤ 500 bản mỗi loại, kéo ≤ 2.000 bản mỗi loại) */
const MAX_ROUNDS = 20;

interface SyncStatus {
  running: boolean;
  /** Lỗi lần đồng bộ gần nhất (mạng, server); null là thành công */
  error: string | null;
}

export const useSyncStatus = create<SyncStatus>(() => ({ running: false, error: null }));

let running: Promise<void> | null = null;
let again = false;

/** Đồng bộ ngay nếu đã đăng nhập. `pickJob`: sau lần đầu, chuyển sang nơi làm có dữ liệu. */
export function syncNow(opts: { pickJob?: boolean } = {}): Promise<void> {
  if (useSession.getState().status !== 'signedIn') return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    useSyncStatus.setState({ running: true });
    try {
      do {
        again = false;
        await runRounds();
      } while (again);
      if (opts.pickJob) {
        const { settings, jobs, workDays } = getData();
        const pick = pickActiveJob(settings.activeJobId, jobs, workDays);
        if (pick && pick !== settings.activeJobId) writeSettings({ activeJobId: pick });
      }
      useSyncStatus.setState({ error: null });
    } catch (err) {
      useSyncStatus.setState({ error: err instanceof ApiError ? err.message : 'Đồng bộ thất bại, sẽ thử lại sau' });
      throw err;
    } finally {
      useSyncStatus.setState({ running: false });
      running = null;
    }
  })();
  return running;
}

async function runRounds(): Promise<void> {
  const rejectedIds = new Set<string>();
  const rejections: SyncRejection[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const before = getData();
    const jobs = pickDirty(before.jobs, rejectedIds);
    const workDays = pickDirty(before.workDays, rejectedIds);
    const weeklyPays = pickDirty(before.weeklyPays, rejectedIds);
    const s = before.settings;
    const sendSettings = s.settingsDirty && s.deductRateUpdatedAt ? s.deductRateUpdatedAt : null;

    const res = await authed(() =>
      api.POST('/v1/sync', {
        body: {
          since: before.sync.since,
          jobs: jobs.map(jobToChange),
          workDays: workDays.map(workDayToChange),
          weeklyHolidayPays: weeklyPays.map(weeklyToChange),
          ...(before.settings.firstOpenAt ? { firstOpenAt: before.settings.firstOpenAt } : {}),
          ...(sendSettings ? { settings: { deductRate: s.deductRate, updatedAt: sendSettings } } : {}),
        },
      }),
    );

    // Đọc lại store: người dùng có thể đã sửa trong lúc chờ server
    const now = getData();
    const j = applyResults('job', now.jobs, jobs, res.jobResults);
    const d = applyResults('workDay', now.workDays, workDays, res.results);
    const w = applyResults('weeklyPay', now.weeklyPays, weeklyPays, res.weeklyHolidayPayResults);
    writeJobs(j.clean);
    writeWorkDays(d.clean);
    writeWeeklyPays(w.clean);
    for (const r of [...j.rejections, ...d.rejections, ...w.rejections]) {
      rejectedIds.add(r.id);
      rejections.push(r);
    }

    writeJobs(mergeRemote(getData().jobs, res.jobs.map(jobFromApi)));
    writeWorkDays(mergeRemote(getData().workDays, res.workDays.map(workDayFromApi)));
    writeWeeklyPays(mergeRemote(getData().weeklyPays, res.weeklyHolidayPays.map(weeklyFromApi)));

    const settingsPatch = mergeSettings(getData().settings, sendSettings, res.settingsResult, res.settings);
    const firstOpen = res.firstOpenAt && res.firstOpenAt !== getData().settings.firstOpenAt ? { firstOpenAt: res.firstOpenAt } : {};
    if (settingsPatch || firstOpen.firstOpenAt) writeSettings({ ...settingsPatch, ...firstOpen });

    writeSyncMeta({ since: res.serverTime, lastSyncedAt: new Date().toISOString(), rejections });

    const after = getData();
    const moreToSend =
      pickDirty(after.jobs, rejectedIds).length +
        pickDirty(after.workDays, rejectedIds).length +
        pickDirty(after.weeklyPays, rejectedIds).length >
        0 || (after.settings.settingsDirty && !!after.settings.deductRateUpdatedAt && after.settings.deductRateUpdatedAt !== sendSettings);
    if (!res.hasMore && !moreToSend) return;
  }
}
