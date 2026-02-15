
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  deleteDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import type { MatchData } from './types';

/**
 * @fileOverview 대회 및 경기 데이터를 Firestore와 연동하는 서비스입니다.
 */

export interface Tournament {
  id?: string;
  name: string;
  startDate: string;
  endDate?: string;
  createdAt: any;
}

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
  async getTournaments() {
    const snapshot = await getDocs(collection(db, TOURNAMENTS_COL));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
  },

  // 특정 대회에 경기 데이터 추가
  async addMatchToTournament(tournamentId: string, matchData: MatchData) {
    const docRef = await addDoc(collection(db, MATCHES_COL), {
      tournamentId,
      ...matchData,
      uploadedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // 특정 대회의 모든 경기 가져오기
  async getMatchesByTournament(tournamentId: string) {
    const q = query(collection(db, MATCHES_COL), where('tournamentId', '==', tournamentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // 경기 삭제
  async deleteMatch(matchId: string) {
    await deleteDoc(doc(db, MATCHES_COL, matchId));
  },

  // 대회 삭제
  async deleteTournament(tournamentId: string) {
    await deleteDoc(doc(db, TOURNAMENTS_COL, tournamentId));
  }
};
