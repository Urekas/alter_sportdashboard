
'use server';
/**
 * @fileOverview 하키 경기 데이터를 분석하여 전술적 요약을 생성하는 AI 에이전트입니다.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MatchAnalysisInputSchema = z.object({
  type: z.enum(['single', 'tournament']).describe('분석 유형 (단일 경기 또는 대회 누적)'),
  matchName: z.string().optional(),
  homeTeam: z.object({ name: z.string() }),
  awayTeam: z.object({ name: z.string() }),
  stats: z.any().describe('경기 또는 대회 통계 데이터 JSON'),
});

export type MatchAnalysisInput = z.infer<typeof MatchAnalysisInputSchema>;

const MatchAnalysisOutputSchema = z.object({
  summary: z.string().describe('전체적인 경기/대회 요약 (2-3문장)'),
  tacticalAnalysis: z.array(z.string()).describe('주요 전술적 포인트 3-4가지'),
  strengths: z.array(z.string()).describe('강점'),
  weaknesses: z.array(z.string()).describe('개선점'),
  verdict: z.string().describe('최종 평가 한줄평'),
});

export type MatchAnalysisOutput = z.infer<typeof MatchAnalysisOutputSchema>;

const analysisPrompt = ai.definePrompt({
  name: 'matchAnalysisPrompt',
  input: { schema: MatchAnalysisInputSchema },
  output: { schema: MatchAnalysisOutputSchema },
  prompt: `# Role
당신은 국가대표팀 퍼포먼스 분석관입니다. 
당신의 임무는 제공된 '경기 데이터 리포트'를 해석하여 감독이 전술적 의사결정을 내릴 수 있도록 돕는 것입니다.

# Context
- 경기: {{matchName}}
- 스코어 및 결과: {{stats.scoreResult}} (예: 2-2 Draw)
- 분석 팀: {{homeTeam.name}} (Blue/Home) vs {{awayTeam.name}} (Red/Away)

# Data Analysis Instructions (Step-by-Step)

## 1. Momentum & Flow (모멘텀 그래프 해석)
- 경기 흐름 그래프(Momentum Chart)를 분석하십시오. 
- 우리 팀이 주도권을 완전히 장악했던 시간대(Peak)와 상대에게 밀렸던 시간대(Valley)를 식별하십시오.
- *가이드:* "2쿼터 중반부터 점유율이 급격히 상승했으나, 실질적인 슈팅으로 연결되지 못했습니다"와 같이 서술하세요.

## 2. Efficiency Quadrant (산점도 해석)
- [서클 진입 횟수(X축)] 대비 [슈팅/득점 기대값(Y축)] 데이터를 확인하십시오.
- 우리 팀이 4분면 중 어디에 위치합니까?
  - **High Entry / Low Shot:** "공격 작업은 활발했으나 문전 세밀함 부족 (결정력 문제)"
  - **Low Entry / High Shot:** "제한된 기회 속에서 높은 효율 (카운터 어택 적중)"
  - **High Entry / High Shot:** "압도적인 경기력"
  - **Low Entry / Low Shot:** "공격 전개 자체의 실패"

## 3. Spatial Pressing (존 데이터 & 압박 맵 해석)
- 수비 성공(Recovery) 위치를 분석하십시오.
- **High Press:** 상대 진영(Zone 7,8,9)에서의 탈취가 많았다면 전방 압박이 유효했음을 칭찬하십시오.
- **Mid Block:** 미드필드(Zone 4,5,6)에서의 차단이 많았다면 허리 싸움에서의 우위를 언급하십시오.
- **Low Block:** 우리 진영(Zone 1,2,3)에서의 수비 수치가 높다면, 라인이 너무 밀리지 않았는지 우려를 표하십시오.

## 4. Synthesis (종합 결론)
- 위 3가지 요소를 종합하여 승리/패배/무승부의 원인을 **한 문장으로 정의**하십시오.
- 예: "전방 압박(High Press)을 통해 모멘텀은 확보했으나(Graph), 서클 내부에서의 결정력 부재(Scatter Plot)로 인해 무승부에 그침."

# Tone
- 감정적인 표현을 배제하고, 철저히 **데이터에 기반한 인과관계**만 서술하십시오.
- 보고서는 **'현상(Fact) -> 원인(Reason) -> 제언(Suggestion)'** 구조를 유지하세요`,
});

export async function analyzeMatch(input: MatchAnalysisInput): Promise<MatchAnalysisOutput> {
  const result = await analyzeMatchFlow(input);
  return result;
}

const analyzeMatchFlow = ai.defineFlow(
  {
    name: 'analyzeMatchFlow',
    inputSchema: MatchAnalysisInputSchema,
    outputSchema: MatchAnalysisOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await analysisPrompt(input);
      if (!output) throw new Error('AI 분석 결과를 생성하지 못했습니다.');
      return output;
    } catch (error: any) {
      if (error.message?.includes('API_KEY')) {
        throw new Error('Gemini API 키가 설정되지 않았거나 유효하지 않습니다. .env 파일을 확인해주세요.');
      }
      throw error;
    }
  }
);
