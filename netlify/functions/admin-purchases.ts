import type { Context } from '@netlify/functions';
import { assertMethod, handleError, json } from './_lib/http';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { assertPurchasesReady, loadPurchaseOverview, loadPurchases } from './_lib/purchases';

export default async (request: Request, context: Context) => {
  try {
    assertMethod(request, 'GET');
    await requirePlatformAdmin(request, context);
    const params = new URL(request.url).searchParams;
    const view = params.get('view') || 'purchases';
    if (!['purchases', 'overview'].includes(view)) return json({ error: 'Vue inconnue.' }, 400);
    await assertPurchasesReady();
    return json(view === 'overview' ? await loadPurchaseOverview() : await loadPurchases(params));
  } catch (err) {
    return handleError(err);
  }
};
