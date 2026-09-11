import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  // 1. Try querying fdw_support_tickets view
  const { data: vData, error: vError } = await (supabase as any)
    .from('fdw_support_tickets')
    .select('*')

  // 2. Try querying prod_db.support_tickets schema
  const { data: sData, error: sError } = await (supabase as any)
    .schema('prod_db')
    .from('support_tickets')
    .select('*')

  // 3. Try querying local support_tickets
  const { data: lData, error: lError } = await supabase
    .from('support_tickets')
    .select('*')

  return NextResponse.json({
    fdw_view: { data: vData, error: vError?.message || vError },
    fdw_schema: { data: sData, error: sError?.message || sError },
    local_table: { data: lData, error: lError?.message || lError },
  })
}
