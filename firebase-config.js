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

// Firestore 데이터베이스 ID
// 콘솔 상단 선택 메뉴에 "default"(괄호 없음)로 보이는 데이터베이스를 쓰고 있어서 이름을 지정합니다.
// 괄호가 붙은 "(default)" 데이터베이스를 쓸 경우엔 "" 로 비워두세요.
export const DATABASE_ID = "default";
