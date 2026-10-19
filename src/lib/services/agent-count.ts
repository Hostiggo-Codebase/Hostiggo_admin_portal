type AgentCountClient = {
  rpc: (
    name: string,
    args: { p_agent_id: string },
  ) => PromiseLike<{ error: { message: string } | null }>
}

// Slot accounting must not turn an already-persisted ticket action into a
// failed request. Supabase's RPC builder is thenable, but has no .catch().
export async function adjustAgentCount(
  client: AgentCountClient,
  agentId: string,
  direction: 'increment' | 'decrement',
): Promise<void> {
  try {
    const { error } = await client.rpc(`${direction}_agent_count`, { p_agent_id: agentId })
    if (error) console.error('Agent count update failed:', error.message)
  } catch (error) {
    console.error('Agent count update failed:', error)
  }
}
