import { Modal } from './Modal';
import type { Language } from '../types';

export function RecordDiscardDialog({ lang, onKeep, onDiscard }: {
  lang: Language; onKeep: () => void; onDiscard: () => void;
}) {
  const zh = lang === 'zh';
  return <Modal title={zh ? '放弃未保存的输入？' : 'Discard unsaved entries?'} onClose={onKeep} footer={<>
    <button className="btn btn-primary" onClick={onKeep}>{zh ? '继续编辑' : 'Keep editing'}</button>
    <button className="btn btn-secondary" onClick={onDiscard}>{zh ? '放弃输入并关闭' : 'Discard entries and close'}</button>
  </>}><p>{zh ? '当前表单输入将丢失。已保存的记录和待同步的更改会保留；关闭表单不会撤销已提交的保存。' : 'Current form entries will be lost. Saved records and pending sync changes remain; closing this form does not undo a submitted save.'}</p></Modal>;
}
