import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, writeBatch, doc, query, orderBy, limit, where, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// [Step 1 & 2] 실제 프로젝트 Config (alter-sportsplay)
const firebaseConfig = {
  "projectId": "studio-7396439909-84f0d",
  "appId": "1:735181437174:web:9cb23a873845f7ee1e94d7",
  "apiKey": "AIzaSyC4W6hwVEJzYH8Gq0-P5cydXY5umtppOeE",
  "authDomain": "studio-7396439909-84f0d.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "735181437174"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

console.log("Firebase & Firestore가 초기화되었습니다. App Name: ", app.name);

// ES6 모듈 Export (다른 파일에서 가져다 사용)
export { db, collection, addDoc, getDocs, writeBatch, doc, query, orderBy, limit, where, updateDoc };
