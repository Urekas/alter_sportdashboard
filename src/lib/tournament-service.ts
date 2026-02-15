
'use server';
/**
 * @fileOverview 대회 및 경기 데이터를 Firestore와 연동하는 서비스입니다.
 */

import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  deleteDoc, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import type { MatchData, Tournament } from './types';

const TOURNAMENTS_COL = 'tournaments';
const MATCHES_COL = 'matches';

export const TournamentService = {
  // 대회 생성
  async createTournament(name: string, startDate: string) {
    const docRef = await addDoc(collection(db, TOURNAMENTS_COL), {
      name,
      startDate,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // 대회 목록 가져오기
  async getTournaments(): Promise<Tournament[]> {
    const q = query(collection(db, TOURNAMENTS_COL), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
  },

  // 특정 대회에 경기 데이터 추가
  async addMatchToTournament(tournamentId: string, matchData: MatchData) {
    const docRef = await addDoc(collection(db, MATCHES_COL), {
      ...matchData,
      tournamentId,
      uploadedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // 특정 대회의 모든 경기 가져오기
  async getMatchesByTournament(tournamentId: string): Promise<MatchData[]> {
    const q = query(
      collection(db, MATCHES_COL), 
      where('tournamentId', '==', tournamentId),
      orderBy('uploadedAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MatchData));
  },

  // 경기 삭제
  async deleteMatch(matchId: string) {
    await deleteDoc(doc(db, MATCHES_COL, matchId));
  },

  // 대회 삭제
  async deleteTournament(tournamentId: string) {
    await deleteDoc(doc(db, TOURNAMENTS_COL, tournamentId));
    // 주의: 실제 서비스에서는 대회에 속한 경기도 함께 삭제하는 배치가 필요함
  }
};
