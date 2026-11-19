// Sportscode 코드윈도우(.CWcode2SC)를 읽어서 JSON으로 돌려줌 — bplist·zlib 해석이 node에서만 돼서 서버에서 처리
import { NextResponse } from 'next/server'
import { parseCodeWindow } from '@/lib/alter/cwImport'
import { slimCW } from '@/lib/tag-engine'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const name = decodeURIComponent(req.headers.get('x-file-name') || 'codewindow').replace(/\.CWcode2SC$/i, '')
    const buf = Buffer.from(await req.arrayBuffer())
    if (!buf.length) return NextResponse.json({ error: '빈 파일이에요' }, { status: 400 })
    if (buf.length > 50 * 1024 * 1024) return NextResponse.json({ error: '파일이 너무 커요 (50MB 넘음)' }, { status: 413 })
    const cw = parseCodeWindow(buf, name)
    return NextResponse.json(slimCW(cw))
  } catch (e) {
    return NextResponse.json({ error: '코드윈도우를 읽지 못했어요: ' + String((e as Error)?.message ?? e) }, { status: 400 })
  }
}
