
'use client';
/**
 * @fileOverview 대회 및 경기 데이터를 Firestore와 연동하는 서비스입니다.
 */

import { 
  collection, 
  addDoc, 
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
  // 대회 목록 가져오기 (에러 해결용)
  async getTournaments() {
    const q = query(collection(db, TOURNAMENTS_COL), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
  },

  // 대회 생성
  async createTournament(name: string, startDate: string) {
    const docRef = await addDoc(collection(db, TOURNAMENTS_COL), {
      name,
      startDate,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // 대회 수정
  async updateTournament(id: string, name: string) {
    if (!id) return;
    const docRef = doc(db, TOURNAMENTS_COL, id);
    await updateDoc(docRef, { name });
  },

  // 특정 대회에 경기 데이터 추가
  async addMatchToTournament(tournamentId: string, matchData: MatchData) {
    const q = query(collection(db, MATCHES_COL), where('tournamentId', '==', tournamentId));
    const countSnapshot = await getCountFromServer(q);
    const nextOrder = countSnapshot.data().count;

    const { id, ...dataToSave } = matchData;
    await addDoc(collection(db, MATCHES_COL), {
      ...dataToSave,
      tournamentId,
      orderIndex: nextOrder,
      uploadedAt: serverTimestamp(),
    });
  },

  // 경기 이름 수정
  async updateMatchName(matchId: string, matchName: string) {
    if (!matchId) return;
    const docRef = doc(db, MATCHES_COL, matchId);
    await updateDoc(docRef, { matchName });
  },

  // 경기 순서 업데이트
  async updateMatchOrder(matchId: string, newOrder: number) {
    if (!matchId) return;
    const docRef = doc(db, MATCHES_COL, matchId);
    await updateDoc(docRef, { orderIndex: newOrder });
  },

  // 기존 경기 데이터 교체
  async updateMatchData(matchId: string, matchData: MatchData) {
    if (!matchId) return;
    const { id, uploadedAt, ...dataToSave } = matchData;
    const docRef = doc(db, MATCHES_COL, matchId);
    await updateDoc(docRef, {
      ...dataToSave,
      updatedAt: serverTimestamp(),
    });
  },

  // 경기 삭제
  async deleteMatch(matchId: string) {
    if (!matchId) return;
    const matchRef = doc(db, MATCHES_COL, matchId);
    await deleteDoc(matchRef);
  },

  // 대회 삭제
  async deleteTournament(tournamentId: string) {
    if (!tournamentId) return;
    const tourneyRef = doc(db, TOURNAMENTS_COL, tournamentId);
    await deleteDoc(tourneyRef);
    
    const q = query(collection(db, MATCHES_COL), where('tournamentId', '==', tournamentId));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, MATCHES_COL, d.id)));
    await Promise.all(deletePromises);
  }
};
