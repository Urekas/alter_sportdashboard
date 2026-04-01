# Field Focus (필드 포커스) ⚽️🥅

Field Focus is a professional sports performance analysis dashboard designed for elite coaching staffs and analysts. It transforms raw data into actionable tactical insights using advanced visualization and AI analysis.

**필드 포커스**는 엘리트 코칭 스탭과 분석관을 위한 전문 스포츠 퍼포먼스 분석 대시보드입니다. 로우 데이터를 고도화된 시각화와 AI 분석을 통해 즉각 활용 가능한 전술적 인사이트로 변환합니다.

---

## 🛠 How it was built (기술 아키텍처)

This application is built with a modern web stack to ensure high performance, scalability, and seamless AI integration.

이 애플리케이션은 고성능, 확장성, 그리고 원활한 AI 통합을 위해 최신 웹 기술 스택으로 구축되었습니다.

- **Frontend**: Built with **Next.js 15 (App Router)** for optimized rendering and **Tailwind CSS** for a premium, responsive design. UI components are powered by **Radix UI** and **Lucide React**.
  - **프론트엔드**: 최적화된 렌더링을 위한 **Next.js 15 (App Router)**와 프리미엄 반응형 디자인을 위한 **Tailwind CSS**로 구축되었습니다. UI 컴포넌트는 **Radix UI**와 **Lucide React**를 활용합니다.
- **Backend & Database**: Utilizes **Firebase** (Firestore) for real-time data persistence and **Firebase App Hosting** for stable deployment.
  - **백엔드 & 데이터베이스**: 실시간 데이터 유지를 위해 **Firebase** (Firestore)를 사용하며, 안정적인 배포를 위해 **Firebase App Hosting**을 이용합니다.
- **AI Engine**: Integrated with **Google Genkit AI** to automate complex tactical analysis, providing human-like insights from statistical data.
  - **AI 엔진**: 복잡한 전술 분석을 자동화하기 위해 **Google Genkit AI**를 통합하여 통계 데이터로부터 인간과 유사한 인사이트를 제공합니다.
- **Data Processing**: Features custom-built **XML & CSV parsers** designed to handle data exports from professional video analysis software like **Sportscode**.
  - **데이터 처리**: **Sportscode**와 같은 전문 비디오 분석 소프트웨어의 데이터 내보내기를 처리하도록 설계된 전용 **XML & CSV 파서**를 포함하고 있습니다.

---

## ✨ Core Features (주요 기능)

### 1. Match & Tournament Analysis (경기 및 대회 분석)
- **Single Match Report**: Drill down into specific match performance metrics.
  - **경기별 분석**: 특정 경기의 퍼포먼스 지표를 심층적으로 분석합니다.
- **Tournament Cumulative Data**: Track team progress and trends across multiple matches.
  - **대회 누적 분석**: 여러 경기에 걸친 팀의 성장과 트렌드를 추적합니다.

### 2. AI Tactical Insights (AI 전술 인사이트)
- Automatically generates comprehensive tactical reports including summaries, key tactical points, strengths, weaknesses, and a final verdict.
- 요약, 주요 전술 포인트, 강점, 개선점, 그리고 최종 판결(Verdict)을 포함한 종합 전술 리포트를 자동으로 생성합니다.

### 3. Advanced Visualization (고급 시각화)
- **Pressure Battle Chart**: Visualize the intensity and location of pressing actions.
  - **압박 분석 차트**: 압박 행동의 강도와 위치를 시각화합니다.
- **Attack Threat & Trajectory**: Analyze offensive efficiency and ball movement patterns.
  - **공격 위협 및 궤적**: 공격 효율성과 볼 이동 패턴을 분석합니다.
- **Tactical Quadrants**: Evaluate performance efficiency (e.g., Possession vs. Circle Entry).
  - **전술 사분면**: 퍼포먼스 효율성을 평가합니다 (예: 점유율 대비 서클 진입).

### 4. Integrated Video Analysis - Sports Play (통합 비디오 분석 - 스포츠 플레이) 📹
- **Frame-by-Frame Review**: Precision control for detailed play analysis.
  - **프레임 단위 검토**: 정밀한 제어를 통한 상세 경기 분석.
- **Drawing & Annotation**: Add tactical drawings directly on the video.
  - **전술 드로잉 및 주석**: 비디오 위에 직접 전술 선과 주석을 추가합니다.
- **Match Linkage**: Automatically syncs and opens videos based on match data IDs.
  - **경기 연동**: 경기 데이터 ID를 바탕으로 비디오를 자동으로 동기화하고 엽니다.

### 5. Professional Metrics (전문 지표)

- **SPP (Seconds Per Press)**: Measures pressing intensity.
- **Build25 Ratio**: Evaluates the efficiency of advancing into the attacking 25m zone.
- **Time per CE**: Measures the directness and speed of circle entries.

---

## 🚀 How to Use (사용 방법)

### 1. Data Preparation (데이터 준비)
- Export your match data from **Sportscode** or similar tools in **XML** or **CSV** format.
- **Sportscode** 등의 도구에서 경기 데이터를 **XML** 또는 **CSV** 형식으로 내보냅니다.

### 2. Upload & Setup (업로드 및 설정)
- Click the **Upload (업로드)** button to import your file.
- 파일을 가져오기 위해 **업로드** 버튼을 클릭합니다.
- Select the **Home (홈)** and **Away (어웨이)** teams from the detected list and assign team colors.
- 감지된 목록에서 **홈**과 **어웨이** 팀을 선택하고 팀 색상을 지정합니다.

### 3. Analysis & AI Report (분석 및 AI 리포트)
- Explore interactive charts to understand match dynamics.
- 대화형 차트를 통해 경기 흐름을 파악합니다.
- Click **Run AI Analysis (AI 전술 분석 실행)** to generate a detailed tactical summary.
- 상세 전술 요약을 생성하려면 **AI 전술 분석 실행**을 클릭하세요.
- Click **Video Analysis Tool (비디오 분석 도구)** to open the integrated **Sports Play** interface for visual review.
- 시각적 검토를 위해 통합된 **스포츠 플레이** 인터페이스를 열려면 **비디오 분석 도구**를 클릭하세요.


### 4. Export & Share (내보내기 및 공유)
- Use the **PDF** button to generate a clean, professional report for the coaching staff.
- **PDF** 버튼을 사용하여 코칭 스탭을 위한 전문적인 리포트를 생성합니다.

---

## 👨‍💻 Getting Started for Developers (개발자 시작하기)

### Installation (설치)
```bash
npm install
```

### Local Development (로컬 개발)
```bash
npm run dev
```
Visit `http://localhost:9002` to see the dashboard in action.

### Deployment (배포)
Deploy to Firebase using the following:
```bash
firebase deploy
```

---

*Enjoy the next era of sports analysis with Field Focus!*
*필드 포커스와 함께 스포츠 분석의 새로운 미래를 경험하세요!*

---
**Firebase Studio Export Date:** 2026-03-23
