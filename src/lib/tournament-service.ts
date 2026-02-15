'use client';
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
  updateDoc,
  serverTimestamp,
  getCountFromServer,
  setDoc
} from 'firebase/firestore';
import type { MatchData, Tournament } from './types';

const TOURNAMENTS_COL = 'tournaments';
const MATCHES_COL = 'matches';

export const TournamentService = {
  // 대회 생성
  async createTournament(name: string, startDate: string) {
    try {
      const docRef = await addDoc(collection(db, TOURNAMENTS_COL), {
        name,
        startDate,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error: any) {
      console.error("Error in createTournament:", error);
      throw error;
    }
  },

  // 대회 수정 (이름 변경 등)
  async updateTournament(id: string, name: string) {
    const docRef = doc(db, TOURNAMENTS_COL, id);
    await updateDoc(docRef, { name });
  },

  // 대회 목록 가져오기
  async getTournaments(): Promise<Tournament[]> {
    try {
      const q = query(collection(db, TOURNAMENTS_COL));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      return [];
    }
  },

  // 특정 대회의 경기 수 가져오기
  async getMatchCount(tournamentId: string): Promise<number> {
    try {
      const q = query(collection(db, MATCHES_COL), where('tournamentId', '==', tournamentId));
      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      return 0;
    }
  },

  // 특정 대회에 경기 데이터 추가
  async addMatchToTournament(tournamentId: string, matchData: MatchData) {
    try {
      const { id, ...dataToSave } = matchData;
      await addDoc(collection(db, MATCHES_COL), {
        ...dataToSave,
        tournamentId,
        uploadedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error adding match to tournament:", error);
      throw error;
    }
  },

  // 기존 경기 데이터 교체 (Update)
  async updateMatchData(matchId: string, matchData: MatchData) {
    try {
      const { id, ...dataToSave } = matchData;
      const docRef = doc(db, MATCHES_COL, matchId);
      await updateDoc(docRef, {
        ...dataToSave,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating match data:", error);
      throw error;
    }
  },

  // 특정 대회의 모든 경기 가져오기
  async getMatchesByTournament(tournamentId: string): Promise<MatchData[]> {
    try {
      const q = query(
        collection(db, MATCHES_COL), 
        where('tournamentId', '==', tournamentId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MatchData));
    } catch (error) {
      console.error("Error fetching matches:", error);
      return [];
    }
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
