import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecordBatchDraft, RecordDraft } from '../src/features/recordDraft';
const original = () => ({ id: 'synthetic-record', duration: 30, items: [{ name: 'Synthetic', weight: 20 }], notes: '' });
test('an open editor refuses an unseen update or deletion and ignores object field ordering', () => {
    const record = original(), editor = new RecordDraft(record);
    assert.equal(editor.canSave({ notes: '', items: [{ weight: 20, name: 'Synthetic' }], duration: 30, id: record.id }), true);
    assert.equal(editor.canSave({ ...record, duration: 45 }), false);
    assert.equal(editor.canSave(undefined), false);
    assert.equal(editor.canSave({ ...record, items: [{ name: 'Synthetic', weight: 25 }] }), false);
    assert.equal(editor.canSave(record), true);
});
test('an uncertain write can be retried and corrected without accepting another writer', () => {
    const record = original(), editor = new RecordDraft(record), first = { ...record, duration: 45 };
    editor.submittedValue(first);
    assert.equal(editor.canSave(record), true, 'a failure before enqueue remains retryable');
    editor.observe(first);
    assert.equal(editor.canSave(first), true, 'the editor recognizes its own queued or committed result');
    assert.equal(editor.canSave({ ...first, notes: 'Another writer' }), false);
    const corrected = { ...first, duration: 60 };
    editor.submittedValue(corrected);
    assert.equal(editor.canSave(first), true);
    assert.equal(editor.canSave(corrected), true);
    assert.equal(editor.canSave(record), false, 'the old baseline is retired after the own write is observed');
});
test('failed intermediate attempts do not forget an earlier uncertain write', () => {
    const record = original(), editor = new RecordDraft(record), first = { ...record, duration: 45 }, second = { ...record, duration: 60 };
    editor.submittedValue(first);
    editor.submittedValue(second);
    assert.equal(editor.canSave(first), true);
    assert.equal(editor.canSave({ ...first, notes: 'Remote' }), false);
});
test('a new draft cannot resurrect a record deleted after its own save became visible', () => {
    const editor = new RecordDraft<ReturnType<typeof original>>(undefined), record = original();
    assert.equal(editor.canSave(undefined), true);
    editor.submittedValue(record);
    editor.observe(record);
    assert.equal(editor.canSave(undefined), false);
});
test('delete retry accepts its own missing record while a changed delete confirmation is rejected', () => {
    const record = original(), deletion = new RecordDraft(record);
    assert.equal(deletion.canSave({ ...record, notes: 'New remote notes' }), false);
    deletion.submittedValue(undefined);
    assert.equal(deletion.canSave(undefined), true);
    assert.equal(deletion.canSave({ ...record, notes: 'Recreated elsewhere' }), false);
});

test('an uncertain food batch preserves its submitted membership while allowing value corrections', () => {
    const first = original(), second = { ...original(), id: 'another-synthetic-record' };
    const batch = new RecordBatchDraft<ReturnType<typeof original>>();
    assert.equal(batch.canSave([first, second], []), true);
    batch.submittedValues([first, second]);
    batch.observe([first, second]);
    assert.equal(batch.hasSubmitted, true);
    assert.equal(batch.canSave([{ ...first, duration: 45 }, second], [first, second]), true);
    assert.equal(batch.canSave([first], [first, second]), false, 'removing a possibly saved item needs a separate reviewed deletion');
    assert.equal(batch.canSave([first, second, { ...first, id: 'new-candidate' }], [first, second]), false);
});

test('one changed or deleted member prevents a stale food batch from overwriting any member', () => {
    const first = original(), second = { ...original(), id: 'another-synthetic-record' };
    const batch = new RecordBatchDraft<ReturnType<typeof original>>();
    batch.submittedValues([first, second]);
    batch.observe([first, second]);
    assert.equal(batch.canSave([first, second], [{ ...first, notes: 'Remote correction' }, second]), false);
    assert.equal(batch.canSave([first, second], [second]), false);
    assert.equal(batch.canSave([first, second], [first, second, { ...first, id: 'unrelated-record' }]), true);
});

test('a food selection may change before submission but repeated candidate identities are rejected', () => {
    const first = original(), batch = new RecordBatchDraft<ReturnType<typeof original>>();
    assert.equal(batch.hasSubmitted, false);
    assert.equal(batch.canSave([first, first], []), false);
    assert.equal(batch.canSave([first], []), true);
    batch.submittedValues([first]);
    const corrected = { ...first, duration: 45 };
    batch.submittedValues([corrected]);
    assert.equal(batch.canSave([corrected], [first]), true, 'an earlier uncertain result remains retryable');
});
