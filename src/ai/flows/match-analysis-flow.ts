
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
  matchSummary: z.string().describe('1. 경기 최종 결과 요약 (경기명, 최종 스코어, 공격 점유율, 핵심적인 경기 지배력 평가)'),
  kpiAnalysis: z.string().describe('2. 핵심 성능 지표 (KPI) 분석 (압도적인 압박 강도, 안정적인 빌드업, 서클 진입 효율, 페널티코너 상황, 슈팅 갯수 등)'),
  dataInterpretation: z.string().describe('3. 주요 그래프 및 데이터 해석 (위협도 추이, 점유 및 속도, 압박 성공률, 서클 진입 방향)'),
  quarterlyAnalysis: z.string().describe('4. 쿼터별 세부 특징 (1~4쿼터 핵심 스탯 바탕의 전술적 특징)'),
  finalVerdict: z.string().describe('5. 최종 분석 (데이터 지배력과 실제 스코어 상관관계, 잘된 점, 개선점)'),
});

export type MatchAnalysisOutput = z.infer<typeof MatchAnalysisOutputSchema>;

const analysisPrompt = ai.definePrompt({
  name: 'matchAnalysisPrompt',
  input: { schema: MatchAnalysisInputSchema },
  output: { schema: MatchAnalysisOutputSchema },
  prompt: `당신은 국가대표팀 스포츠 과학 현장지원을 담당하는 전문 비디오 분석관이다. 제공되는 경기 데이터(통계표 및 수치)를 바탕으로 [Field Focus | Hockey Analytics] 형식의 경기별 상세 분석 보고서를 작성하라.

[작성 가이드라인]
- 문체: 객관적이고 전문적인 '~다'체를 사용한다.
- 분석 관점: 단순 수치 나열을 넘어 지표 간의 인과관계를 분석한다. (예: 낮은 SPP가 상대의 빌드업 무력화로 이어진 점 등)
- 지표 해석 기준:
  * SPP (압박 지수): 수치가 낮을수록 압박 강도가 강함. 상대 수치와 비교하여 압박의 우위를 기술한다.
  * CE 1회당 시간: 수치가 낮을수록 공격 전개가 빠르고 직선적임을 의미한다.
  * 빌드업 정체 비율: 수치가 높을수록 공격 전개 속도가 느리고 지공 위주임을 의미한다.

[보고서 필수 구조]
1. 경기 최종 결과 요약: 경기명, 최종 스코어, 공격 점유율, 핵심적인 경기 지배력 평가를 요약하여 서술한다.
2. 핵심 성능 지표 (KPI) 분석: 다음 지표를 중심으로 분석 내용을 기술한다: 압도적인 압박 강도(SPP), 안정적인 빌드업(성공률), 서클 진입 효율(CE 시간), 페널티코너 상황(PC 성공률), 슈팅 갯수 등.
3. 주요 그래프 및 데이터 해석: 
   - 공격 위협도 추이 (Attack Threat Trend): 시간대별 주도권 변화 설명.
   - 공격 점유 및 속도 분석 (Match Trajectory): 쿼터별 효율성(Direct/Efficient/Slow/Inefficient) 분류.
   - 압박 성공률 상세: 전체 성공률(%) 및 주요 구역(50C, 50R 등) 성과 기술.
   - 서클 진입 방향 및 효율: 좌/중/우 진입 횟수와 성공률을 대조하여 효율적인 공격 경로 도출.
4. 쿼터별 세부 특징: 1쿼터~4쿼터까지 각 쿼터의 핵심 스탯(점유율, 속도, SPP 등)을 바탕으로 해당 시간대의 전술적 특징을 정의한다.
5. 최종 분석: 데이터상의 지배력과 실제 스코어 사이의 상관관계를 분석한다. 잘된 점(고무적인 지표)과 개선이 필요한 점(전술적 숙제)을 명확히 정리하며 마무리한다.

# Context
- 경기: {{matchName}}
- 분석 팀: {{homeTeam.name}} (Home) vs {{awayTeam.name}} (Away)

# Data JSON:
{{stats}}`,
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
