
'use client';

import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getCountFromServer,
  orderBy,
  Firestore
} from 'firebase/firestore';
import { db } from './firebase';
import type { MatchData, Tournament } from './types';

const TOURNAMENTS_COL = 'tournaments';
const MATCHES_COL = 'matches';

export const TournamentService = {
  async getTournaments() {
    try {
      const q = query(collection(db, TOURNAMENTS_COL), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
    } catch (e) {
      console.error("TournamentService.getTournaments failed:", e);
      return [];
    }
  },

  async createTournament(dbInstance: Firestore, name: string, startDate: string, category?: string) {
    const docRef = await addDoc(collection(dbInstance, TOURNAMENTS_COL), {
      name,
      startDate,
      category: category || "미분류",
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateTournament(dbInstance: Firestore, id: string, name: string, category?: string, startDate?: string) {
    if (!id) return;
    const docRef = doc(dbInstance, TOURNAMENTS_COL, id);
    const updates: Record<string, string> = { name };
    if (category !== undefined) updates.category = category;
    if (startDate !== undefined) updates.startDate = startDate;
    await updateDoc(docRef, updates);
  },

  async addMatchToTournament(tournamentId: string, matchData: MatchData, matchNumber?: number) {
    const q = query(collection(db, MATCHES_COL), where('tournamentId', '==', tournamentId));
    const countSnapshot = await getCountFromServer(q);
    const nextOrder = countSnapshot.data().count;

    const { id, ...dataToSave } = matchData;
    const docRef = await addDoc(collection(db, MATCHES_COL), {
      ...dataToSave,
      tournamentId,
      orderIndex: nextOrder,
      uploadedAt: serverTimestamp(),
      ...(typeof matchNumber === 'number' ? { matchNumber } : {}),
    });
    return docRef.id;
  },

  async updateSchedule(dbInstance: Firestore, tournamentId: string, schedule: Tournament['schedule']) {
    if (!tournamentId) return;
    const docRef = doc(dbInstance, TOURNAMENTS_COL, tournamentId);
    await updateDoc(docRef, { schedule });
  },

  async updateFinalStandingsRules(dbInstance: Firestore, tournamentId: string, rules: Tournament['finalStandingsRules']) {
    if (!tournamentId) return;
    const docRef = doc(dbInstance, TOURNAMENTS_COL, tournamentId);
    await updateDoc(docRef, { finalStandingsRules: rules });
  },

  async updateTournamentDescription(dbInstance: Firestore, tournamentId: string, description: string) {
    if (!tournamentId) return;
    const docRef = doc(dbInstance, TOURNAMENTS_COL, tournamentId);
    await updateDoc(docRef, { description });
  },

  // 등록된 경기(MatchData)를 일정표의 "Match #"와 연결합니다 — 참조("Winner 47" 등) 자동치환의 기준 키.
  async updateMatchNumber(dbInstance: Firestore, matchId: string, matchNumber: number | null) {
    if (!matchId) return;
    const docRef = doc(dbInstance, MATCHES_COL, matchId);
    await updateDoc(docRef, { matchNumber: matchNumber === null ? null : matchNumber });
  },

  // 선수단 배포용 리포트 페이지(/report/[matchId])가 쓰는 단건 조회.
  async getMatchById(matchId: string): Promise<MatchData | null> {
    if (!matchId) return null;
    try {
      const snap = await getDoc(doc(db, MATCHES_COL, matchId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as MatchData;
    } catch (e) {
      console.error("TournamentService.getMatchById failed:", e);
      return null;
    }
  },

  async getMatchesByTournament(tournamentId: string) {
    if (!tournamentId) return [];
    try {
      const q = query(collection(db, MATCHES_COL), where('tournamentId', '==', tournamentId));
      const snapshot = await getDocs(q);
      const matches = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MatchData));
      return matches.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    } catch (e) {
      console.error("TournamentService.getMatchesByTournament failed:", e);
      return [];
    }
  },

  async updateMatchName(dbInstance: Firestore, matchId: string, matchName: string) {
    if (!matchId) return;
    const docRef = doc(dbInstance, MATCHES_COL, matchId);
    await updateDoc(docRef, { matchName });
  },

  async updateVideoMatchId(dbInstance: Firestore, matchId: string, videoMatchId: string) {
    if (!matchId) return;
    const docRef = doc(dbInstance, MATCHES_COL, matchId);
    await updateDoc(docRef, { videoMatchId });
  },

  // 팀 이름만 고쳐씁니다(오타 수정 등) — 스탯은 홈/어웨이 자리 그대로라 재계산이 필요 없습니다.
  // 홈/어웨이 자리를 서로 바꾸는 건 다른 문제(스탯도 같이 뒤바뀌어야 함)라 updateMatchData로 처리합니다.
  async updateMatchTeamNames(dbInstance: Firestore, matchId: string, homeName: string, awayName: string) {
    if (!matchId) return;
    const docRef = doc(dbInstance, MATCHES_COL, matchId);
    await updateDoc(docRef, { 'homeTeam.name': homeName, 'awayTeam.name': awayName });
  },

  // events 배열 전체를 다시 씁니다 (예: 특정 이벤트의 관련 선수 메모 추가/수정 후).
  // Sportscode에서 온 이벤트 id가 항상 고유하다고 보장할 수 없어서, 호출 측에서
  // 배열 인덱스 기준으로 수정한 완성된 배열을 넘겨받는 방식으로 설계했습니다.
  async updateEventsField(dbInstance: Firestore, matchId: string, events: MatchData['events']) {
    if (!matchId) return;
    const docRef = doc(dbInstance, MATCHES_COL, matchId);
    await updateDoc(docRef, { events });
  },

  async updateMatchLineups(dbInstance: Firestore, matchId: string, lineups: MatchData['lineups']) {
    if (!matchId) return;
    const docRef = doc(dbInstance, MATCHES_COL, matchId);
    await updateDoc(docRef, { lineups });
  },

  async updateMatchOrder(dbInstance: Firestore, matchId: string, newOrder: number) {
    if (!matchId) return;
    const docRef = doc(dbInstance, MATCHES_COL, matchId);
    await updateDoc(docRef, { orderIndex: newOrder });
  },

  async updateMatchData(dbInstance: Firestore, matchId: string, matchData: MatchData) {
    if (!matchId) return;
    const { id, uploadedAt, ...dataToSave } = matchData;
    const docRef = doc(dbInstance, MATCHES_COL, matchId);
    await updateDoc(docRef, {
      ...dataToSave,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteMatch(dbInstance: Firestore, matchId: string) {
    if (!matchId) return;
    const matchRef = doc(dbInstance, MATCHES_COL, matchId);
    await deleteDoc(matchRef);
  },

  async deleteTournament(dbInstance: Firestore, tournamentId: string) {
    if (!tournamentId) return;
    const tourneyRef = doc(dbInstance, TOURNAMENTS_COL, tournamentId);
    await deleteDoc(tourneyRef);
    
    const q = query(collection(dbInstance, MATCHES_COL), where('tournamentId', '==', tournamentId));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(dbInstance, MATCHES_COL, d.id)));
    await Promise.all(deletePromises);
  }
};
