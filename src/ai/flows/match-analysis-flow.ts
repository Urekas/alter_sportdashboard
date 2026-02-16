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
  prompt: `당신은 세계 최고의 필드하키 전술 분석가입니다. 
제공된 데이터를 바탕으로 {{homeTeam.name}} 팀의 퍼포먼스를 심층 분석해주세요.

분석 유형: {{type}}
경기/대회명: {{matchName}}
상대: {{awayTeam.name}} (또는 대회 평균)

데이터 요약:
{{{json stats}}}

다음 가이드라인을 따라 분석 리포트를 작성하세요:
1. SPP(압박 지수)가 낮을수록 공격적인 압박이 좋았음을 의미합니다.
2. 빌드업 성공률(Build25 Ratio)과 서클 진입 효율(CE Time)의 상관관계를 분석하세요.
3. 쿼터별 통계 변화가 있다면 체력이나 전술 변화 측면에서 언급하세요.
4. 분석은 {{homeTeam.name}} 팀 중심으로 작성하세요.
5. 전문적이면서도 코칭스태프가 이해하기 쉬운 용어를 사용하세요.`,
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
    const { output } = await analysisPrompt(input);
    if (!output) throw new Error('AI 분석 결과를 생성하지 못했습니다.');
    return output;
  }
);
