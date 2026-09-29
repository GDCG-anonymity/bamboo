// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹) 에서 복사한 값으로 바꿔주세요.
export const firebaseConfig = {
  apiKey: "AIzaSyDBXRsfPxNk_WPhnd-HXgW6SRFURTrRlQw",
  authDomain: "gsgw-everytime.firebaseapp.com",
  projectId: "gsgw-everytime",
  storageBucket: "gsgw-everytime.firebasestorage.app",
  messagingSenderId: "697559946043",
  appId: "1:697559946043:web:04e2cb91690da090d4dd1e"
};

// 관리자 계정 이메일 (firestore.rules 의 isAdmin() 안 주소와 반드시 같아야 함)
// 관리자 로그인 화면에서는 비밀번호만 입력합니다.
export const ADMIN_EMAIL = "research1@bamboo.local";
