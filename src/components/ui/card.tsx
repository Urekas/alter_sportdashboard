import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // print:shadow-none/border — 예전엔 globals.css의 .card{...}로 이 두 규칙을 넣으려
      // 했는데 실제 렌더링되는 클래스에 "card"라는 리터럴 토큰이 없어(전부 유틸리티 클래스라
      // bg-card처럼 변수 이름만 들어감) 그 규칙이 한 번도 매칭된 적이 없었음(인쇄 시 그림자가
      // 그대로 남는 원인) — 컴포넌트 자체에 직접 Tailwind print: 변형으로 넣어 확실히 적용.
      "rounded-lg border bg-card text-card-foreground shadow-sm print:shadow-none print:border-[#eee]",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // print:text-[13px] — 마찬가지로 globals.css의 .card-title/[class*="CardTitle"]가
      // 실제로는 매칭되는 요소가 없어(컴포넌트 이름일 뿐 클래스 문자열엔 안 남음) 화면 크기
      // 그대로 인쇄되던 걸 고침. break-after-avoid는 인쇄에서만 의미 있는 속성이라 화면
      // 스크롤엔 영향 없음 — 카드 제목이 페이지 맨 아래 혼자 남고 내용은 다음 페이지로
      // 넘어가는 "고아 제목" 현상 방지.
      "text-2xl font-semibold leading-none tracking-tight print:text-[13px] break-after-avoid",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
