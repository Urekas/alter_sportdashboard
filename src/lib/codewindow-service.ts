'use client';

// 웹 태깅용 코드윈도우 보관 (Firestore 'codeWindows') — 한 번 올리면 모든 경기에서 골라 씀
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
import type { CodeWindow } from './alter/types';
import { isCodeWindowJson, slimCW } from './tag-engine';

const COL = 'codeWindows';

export interface StoredCodeWindow {
  id: string;
  name: string;
  cw: CodeWindow;
}

export async function listCodeWindows(db: Firestore): Promise<{ id: string; name: string }[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? '') }));
}

export async function getCodeWindow(db: Firestore, id: string): Promise<StoredCodeWindow | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { id, name: d.name, cw: JSON.parse(d.json) as CodeWindow };
}

/** 파일 읽기: .CWcode2SC는 서버에서, Alter Live JSON은 바로 */
export async function readCodeWindowFile(file: File): Promise<CodeWindow> {
  if (/\.json$/i.test(file.name)) {
    const v = JSON.parse(await file.text());
    if (!isCodeWindowJson(v)) throw new Error('Alter Live 코드윈도우 JSON이 아니에요');
    return slimCW({ ...v, name: v.name || file.name.replace(/\.json$/i, '') });
  }
  const res = await fetch('/api/codewindow', { method: 'POST', headers: { 'x-file-name': encodeURIComponent(file.name) }, body: await file.arrayBuffer() });
  const v = await res.json();
  if (!res.ok) throw new Error(v.error || '코드윈도우를 읽지 못했어요');
  return v as CodeWindow;
}

export async function saveCodeWindow(db: Firestore, cw: CodeWindow): Promise<string> {
  // 문서 하나에 JSON 문자열로 (Firestore는 배열 안 배열·undefined를 싫어해서)
  const ref = await addDoc(collection(db, COL), { name: cw.name, json: JSON.stringify(cw), createdAt: serverTimestamp() });
  return ref.id;
}

/** 경기마다 마지막으로 쓴 코드윈도우 기억 */
export async function setMatchCodeWindow(db: Firestore, matchId: string, codeWindowId: string | null) {
  await updateDoc(doc(db, 'matches', matchId), { codeWindowId });
}
