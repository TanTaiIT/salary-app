import * as SQLite from 'expo-sqlite';

import type { Job, LocalStorage, Snapshot, WeeklyPayRecord, WorkDayRecord } from './types';

const DB_NAME = 'llhq.db';
const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= SQLite.openDatabaseAsync(DB_NAME).then(async (d) => {
    await migrate(d);
    return d;
  });
  return dbPromise;
}

async function migrate(d: SQLite.SQLiteDatabase): Promise<void> {
  const row = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= SCHEMA_VERSION) return;

  await d.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      hourly_wage INTEGER NOT NULL,
      company_size TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS work_days (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL,
      date TEXT NOT NULL,
      x1 REAL NOT NULL DEFAULT 0,
      x1_5 REAL NOT NULL DEFAULT 0,
      x2 REAL NOT NULL DEFAULT 0,
      x2_5 REAL NOT NULL DEFAULT 0,
      x3 REAL NOT NULL DEFAULT 0,
      allowance INTEGER NOT NULL DEFAULT 0,
      wage_snapshot INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS work_days_job_date ON work_days (job_id, date);
    CREATE TABLE IF NOT EXISTS weekly_holiday_pays (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      amount INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

interface JobRow {
  id: string;
  name: string;
  hourly_wage: number;
  company_size: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
}

interface WorkDayRow {
  id: string;
  job_id: string;
  date: string;
  x1: number;
  x1_5: number;
  x2: number;
  x2_5: number;
  x3: number;
  allowance: number;
  wage_snapshot: number;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
}

interface WeeklyRow {
  id: string;
  job_id: string;
  week_start: string;
  amount: number;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
}

export const storage: LocalStorage = {
  async load(): Promise<Snapshot> {
    const d = await db();
    const jobs = await d.getAllAsync<JobRow>('SELECT * FROM jobs');
    const days = await d.getAllAsync<WorkDayRow>('SELECT * FROM work_days');
    const weekly = await d.getAllAsync<WeeklyRow>('SELECT * FROM weekly_holiday_pays');
    const kv = await d.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM kv');
    return {
      jobs: jobs.map((r) => ({
        id: r.id,
        name: r.name,
        hourlyWage: r.hourly_wage,
        companySize: r.company_size === 'under5' ? 'under5' : '5plus',
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
        dirty: r.dirty === 1,
      })),
      workDays: days.map((r) => ({
        id: r.id,
        jobId: r.job_id,
        date: r.date,
        hours: { x1: r.x1, x1_5: r.x1_5, x2: r.x2, x2_5: r.x2_5, x3: r.x3 },
        allowance: r.allowance,
        wageSnapshot: r.wage_snapshot,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
        dirty: r.dirty === 1,
      })),
      weeklyPays: weekly.map((r) => ({
        id: r.id,
        jobId: r.job_id,
        weekStart: r.week_start,
        amount: r.amount,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
        dirty: r.dirty === 1,
      })),
      kv: Object.fromEntries(kv.map((r) => [r.key, r.value])),
    };
  },

  async putJobs(rows: Job[]) {
    const d = await db();
    await d.withExclusiveTransactionAsync(async (tx) => {
      for (const j of rows) {
        await tx.runAsync(
          `INSERT OR REPLACE INTO jobs (id, name, hourly_wage, company_size, updated_at, deleted_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [j.id, j.name, j.hourlyWage, j.companySize, j.updatedAt, j.deletedAt, j.dirty ? 1 : 0],
        );
      }
    });
  },

  async putWorkDays(rows: WorkDayRecord[]) {
    const d = await db();
    await d.withExclusiveTransactionAsync(async (tx) => {
      for (const w of rows) {
        await tx.runAsync(
          `INSERT OR REPLACE INTO work_days
             (id, job_id, date, x1, x1_5, x2, x2_5, x3, allowance, wage_snapshot, updated_at, deleted_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            w.id,
            w.jobId,
            w.date,
            w.hours.x1,
            w.hours.x1_5,
            w.hours.x2,
            w.hours.x2_5,
            w.hours.x3,
            w.allowance,
            w.wageSnapshot,
            w.updatedAt,
            w.deletedAt,
            w.dirty ? 1 : 0,
          ],
        );
      }
    });
  },

  async putWeeklyPays(rows: WeeklyPayRecord[]) {
    const d = await db();
    await d.withExclusiveTransactionAsync(async (tx) => {
      for (const w of rows) {
        await tx.runAsync(
          `INSERT OR REPLACE INTO weekly_holiday_pays (id, job_id, week_start, amount, updated_at, deleted_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [w.id, w.jobId, w.weekStart, w.amount, w.updatedAt, w.deletedAt, w.dirty ? 1 : 0],
        );
      }
    });
  },

  async putKv(key: string, value: string) {
    const d = await db();
    await d.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]);
  },
};
