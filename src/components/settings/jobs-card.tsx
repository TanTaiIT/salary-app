import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Hint, Label, Segmented } from '@/components/ui';
import { useApp } from '@/data/app-store';
import type { CompanySize, Job } from '@/data/types';
import { confirmAsync } from '@/lib/confirm';
import { formatNumber, formatWon, parseWon } from '@/lib/format';

const SIZES: readonly { value: CompanySize; label: string }[] = [
  { value: '5plus', label: 'Từ 5 người' },
  { value: 'under5', label: 'Dưới 5 người' },
];

/** Nơi làm việc: chọn nơi đang xem, sửa nơi đang chọn, thêm và xóa. Lịch lọc theo nơi đang chọn. */
export function JobsCard({ minimumWage }: { minimumWage: number }) {
  const { job, jobs, selectJob } = useApp();
  const [adding, setAdding] = useState(false);

  return (
    <Card title="Nơi làm việc">
      {jobs.length > 1 ? (
        <>
          <Segmented
            label="Nơi làm đang xem"
            value={job?.id ?? ''}
            options={jobs.map((j) => ({ value: j.id, label: j.name }))}
            onChange={selectJob}
          />
          <Hint>Lịch, thống kê và lịch sử hiện theo nơi làm đang chọn.</Hint>
        </>
      ) : null}
      {/* key: đổi nơi làm thì ô nhập lấy lại giá trị của nơi làm mới */}
      {job ? <JobEditor key={job.id} job={job} minimumWage={minimumWage} canDelete={jobs.length > 1} /> : null}
      {adding ? (
        <NewJob minimumWage={minimumWage} onDone={() => setAdding(false)} />
      ) : (
        <Button label="Thêm nơi làm việc" onPress={() => setAdding(true)} />
      )}
    </Card>
  );
}

function JobEditor({ job, minimumWage, canDelete }: { job: Job; minimumWage: number; canDelete: boolean }) {
  const { updateJob, deleteJob, toast } = useApp();
  const [name, setName] = useState(job.name);
  const [wage, setWage] = useState(formatNumber(job.hourlyWage));

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) return setName(job.name);
    if (trimmed === job.name) return;
    const r = updateJob({ name: trimmed });
    toast(r.ok ? 'Đã lưu tên nơi làm' : r.message);
  };

  const saveWage = () => {
    const v = Math.min(parseWon(wage), 1_000_000);
    if (v <= 0) return setWage(formatNumber(job.hourlyWage));
    setWage(formatNumber(v));
    if (v === job.hourlyWage) return;
    const r = updateJob({ hourlyWage: v });
    toast(r.ok ? 'Đã lưu lương giờ' : r.message);
  };

  const onDelete = async () => {
    const ok = await confirmAsync(
      `Xóa "${job.name}"?`,
      'Mọi ngày công và 주휴수당 của nơi làm này cũng bị xóa, cả trên các máy đã đồng bộ.',
    );
    if (!ok) return;
    const r = deleteJob(job.id);
    toast(r.ok ? 'Đã xóa nơi làm việc' : r.message);
  };

  return (
    <View style={styles.editor}>
      <Field label="Tên" value={name} onChangeText={setName} onBlur={saveName} onSubmitEditing={saveName} maxLength={60} />
      <Label>Mức lương giờ (₩)</Label>
      <Field
        label="Lương giờ"
        keyboardType="number-pad"
        value={wage}
        onChangeText={(t) => setWage(t ? formatNumber(parseWon(t)) : '')}
        onBlur={saveWage}
        onSubmitEditing={saveWage}
      />
      <Hint>
        Lương tối thiểu năm nay là {formatWon(minimumWage)}/giờ. Lương giờ mới áp dụng cho ngày công ghi từ bây giờ;
        ngày đã ghi giữ lương giờ lúc ghi.
      </Hint>
      <Label>Quy mô công ty</Label>
      <Segmented
        label="Quy mô công ty"
        value={job.companySize}
        options={SIZES}
        onChange={(companySize) => updateJob({ companySize })}
      />
      {canDelete ? <Button label="Xóa nơi làm này" variant="danger" onPress={onDelete} /> : null}
    </View>
  );
}

function NewJob({ minimumWage, onDone }: { minimumWage: number; onDone: () => void }) {
  const { addJob, toast } = useApp();
  const [name, setName] = useState('');
  const [wage, setWage] = useState(formatNumber(minimumWage));

  const onAdd = () => {
    const r = addJob(name, parseWon(wage));
    if (!r.ok) return toast(r.message);
    toast('Đã thêm và chọn nơi làm mới');
    onDone();
  };

  return (
    <View style={styles.editor}>
      <Label>Nơi làm mới</Label>
      <Field label="Tên" value={name} onChangeText={setName} maxLength={60} placeholder="Ví dụ: Nhà máy B" />
      <View style={styles.gap} />
      <Field
        label="Lương giờ"
        keyboardType="number-pad"
        value={wage}
        onChangeText={(t) => setWage(t ? formatNumber(parseWon(t)) : '')}
      />
      <Button label="Thêm" variant="primary" disabled={!name.trim() || parseWon(wage) <= 0} onPress={onAdd} />
      <Button label="Hủy" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { marginTop: 12 },
  gap: { height: 8 },
});
