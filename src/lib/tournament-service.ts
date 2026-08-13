
'use client';

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
