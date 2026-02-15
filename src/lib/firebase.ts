
'use client';

import { initializeFirebase } from '@/firebase';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { FirebaseApp } from 'firebase/app';

/**
 * @fileOverview Firebase Studio의 표준 초기화 방식을 사용하도록 수정된 파일입니다.
 * 하드코딩된 프로젝트 ID로 인한 권한 오류를 방지합니다.
 */

// 중앙 집중식 초기화 함수를 호출하여 SDK 인스턴스를 가져옵니다.
const { firebaseApp, auth, firestore } = initializeFirebase();

const app: FirebaseApp = firebaseApp;
const db: Firestore = firestore;
const firebaseAuth: Auth = auth;

export { app, db, firebaseAuth as auth };
