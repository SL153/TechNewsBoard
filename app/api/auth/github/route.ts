export const runtime = 'nodejs';

import { checkRateLimit } from '@/lib/rate-limiter';

const GITHUB_DEVICE_AUTH_URL='https:...code';
const GITHUB_TOKEN_URL='https:...oken';

// POST: Start the device flow — returns device_code + user_code + verification_uri
export async function POST(request: Request) {
  // Rate limit check — prevent auth flow spam
  if (!checkRateLimit('/api/auth/github')) {
    return new Response(
      JSON.stringify({ error: 'Rate limited. Try again in a minute.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const { clientId } = await request.json();

    if (!clientId) {
      return Response.json({ error: 'Missing clientId' }, { status: 400 });
    }

    const res = await fetch(GITHUB_DEVICE_AUTH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'read:user',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `GitHub returned ${res.status}: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to start device flow' },
      { status: 500 },
    );
  }
}

// PUT: Poll for the access token using device_code
export async function PUT(request: Request) {
  try {
    const { clientId, deviceCode } = await request.json();

    if (!clientId || !deviceCode) {
      return Response.json({ error: 'Missing clientId or deviceCode' }, { status: 400 });
    }

    const res = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `GitHub returned ${res.status}: ${text}` }, { status: res.status });
    }

    const data = await res.json();

    // GitHub returns { error: 'authorization_pending' } while user hasn't authorized yet
    if (data.error) {
      return Response.json({ pending: true, error: data.error });
    }

    // Success — return the access_token
    return Response.json({ access_token: data.access_token });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to poll token' },
      { status: 500 },
    );
  }
}
