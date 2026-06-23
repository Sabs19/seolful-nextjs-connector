export interface HandshakePayload {
  clientId: string
  token: string
  siteUrl: string
  siteName: string
  connectionKey: string
  connectorVersion: string
}

export interface HandshakeResult {
  status: string
  siteId: number
  siteUuid: string
  publishEndpoint: string
  newConnectionKey?: string
}

export async function performHandshake(
  appUrl: string,
  payload: HandshakePayload,
): Promise<HandshakeResult> {
  const endpoint = `${appUrl}/api/plugin/handshake`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: payload.clientId,
      token: payload.token,
      site_url: payload.siteUrl,
      site_name: payload.siteName,
      platform: 'nextjs',
      connection_key: payload.connectionKey,
      connector_version: payload.connectorVersion,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Handshake failed: HTTP ${response.status} — ${body.slice(0, 200)}`)
  }

  const data = (await response.json()) as Record<string, unknown>

  return {
    status: data.status as string,
    siteId: data.site_id as number,
    siteUuid: data.site_uuid as string,
    publishEndpoint: data.publish_endpoint as string,
    newConnectionKey: (data.new_connection_key as string | undefined) ?? undefined,
  }
}
