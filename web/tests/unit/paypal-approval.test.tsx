import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePayPalOrder, type PaymentPayload } from '@/lib/paypal';

const recovery = vi.hoisted(() => ({ list: vi.fn((): {kind:'order'|'candle'|'donation';paypalOrderId:string}[] => []), prepare: vi.fn(), confirmDonation: vi.fn() }));
vi.mock('@/lib/pendingFulfilment', () => ({ pendingFulfilment: recovery }));
const ID = 'APPROVED000000001';
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('persists the original approved form before sending capture, even after form edits', async () => {
  const events: string[] = [];
  let payload: PaymentPayload = {type:'order',items:[{_id:'66eb4665c7e03262956c8d1d',quantity:1}],fulfilment:{email:'original@example.com'},cart:'original'};
  recovery.prepare.mockImplementationOnce(() => events.push('persist'));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).endsWith('/create_order')) return json({id:ID});
    events.push('capture');
    return json({id:'CAPTURE_ID_IS_NOT_THE_ORDER_ID',status:'COMPLETED'});
  }));
  const onPaid = vi.fn();
  const {result,rerender} = renderHook(() => usePayPalOrder({getPayload:()=>payload,onPaid}));
  await act(async () => { expect(await result.current.createOrder()).toBe(ID); });
  payload = {...payload,fulfilment:{email:'edited@example.com'},cart:'edited'};
  rerender();
  await act(async () => { await result.current.onApprove({orderID:ID}); });
  expect(events).toEqual(['persist','capture']);
  expect(recovery.prepare).toHaveBeenCalledWith(expect.objectContaining({paypalOrderId:ID,body:{email:'original@example.com'},cart:'original'}));
  expect(onPaid).toHaveBeenCalledWith({id:ID,status:'COMPLETED'});
});

it('never captures if saving the durable approval reference fails', async () => {
  const fetcher = vi.fn(async () => json({id:ID}));
  vi.stubGlobal('fetch',fetcher);
  recovery.prepare.mockImplementationOnce(() => { throw new Error('Storage unavailable'); });
  const onPaid = vi.fn();
  const {result} = renderHook(() => usePayPalOrder({getPayload:()=>({type:'candle'}),onPaid}));
  await act(async () => { await result.current.createOrder(); await result.current.onApprove({orderID:ID}); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(onPaid).not.toHaveBeenCalled();
  expect(result.current.error).toBe('start');
});

it('keeps a pending capture unconfirmed without a success callback', async () => {
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>json(String(url).endsWith('/create_order') ? {id:ID} : {id:ID,status:'PENDING'})));
  const onPaid = vi.fn();
  const {result} = renderHook(() => usePayPalOrder({getPayload:()=>({type:'donation',amount:25}),onPaid}));
  await act(async () => { await result.current.createOrder(); await result.current.onApprove({orderID:ID}); });
  expect(result.current.error).toBe('unconfirmed');
  expect(onPaid).not.toHaveBeenCalled();
  expect(recovery.confirmDonation).not.toHaveBeenCalled();
});

it('blocks a second approved payment while an earlier payment remains unconfirmed', async () => {
  const fetcher = vi.fn(async () => json({id:ID}));
  vi.stubGlobal('fetch',fetcher);
  const {result} = renderHook(() => usePayPalOrder({getPayload:()=>({type:'donation',amount:25}),onPaid:vi.fn()}));
  await act(async () => { await result.current.createOrder(); });
  recovery.list.mockReturnValueOnce([{kind:'donation',paypalOrderId:'EARLIER000000001'}]);
  await act(async () => { await result.current.onApprove({orderID:ID}); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(recovery.prepare).not.toHaveBeenCalled();
  expect(result.current.error).toBe('unconfirmed');
});

// Audit 2026-10-10, F04: the page's total and the amount the API gives PayPal must not silently differ.
it('stops once when the API will charge another amount than the page shows, then accepts it on the next press', async () => {
  const ids = ['FIRST0000000000001', 'SECOND000000000001'];
  const fetcher = vi.fn(async () => json({ id: ids.shift(), amount: 23 }));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => usePayPalOrder({ getPayload: () => ({ type: 'order', items: [{ _id: '66eb4665c7e03262956c8d1d', quantity: 1 }] }), onPaid: vi.fn(), getShownAmount: () => 14 }));

  await act(async () => { await expect(result.current.createOrder()).rejects.toThrow('The price changed'); });
  expect(result.current.error).toBe('priceChanged');
  expect(result.current.priceChange).toEqual({ shown: 14, charged: 23 });
  // PayPal reports the rejected start through onError: the price message stays.
  act(() => result.current.onError());
  expect(result.current.error).toBe('priceChanged');
  // The first PayPal order was never handed to PayPal's window, so it can never be approved or captured here.
  await act(async () => { await result.current.onApprove({ orderID: 'FIRST0000000000001' }); });
  expect(fetcher).toHaveBeenCalledTimes(1);

  // Pressing the button again pays the amount the customer has now been told.
  await act(async () => { expect(await result.current.createOrder()).toBe('SECOND000000000001'); });
  expect(result.current.error).toBeNull();
  // the accepted change stays, so the page keeps saying what is charged (the summary still shows the old total)
  expect(result.current.priceChange).toEqual({ shown: 14, charged: 23 });
});

it('asks again if the amount changes a second time', async () => {
  const amounts = [23, 30, 30];
  vi.stubGlobal('fetch', vi.fn(async () => json({ id: ID, amount: amounts.shift() })));
  const { result } = renderHook(() => usePayPalOrder({ getPayload: () => ({ type: 'candle' }), onPaid: vi.fn(), getShownAmount: () => 3 }));
  await act(async () => { await expect(result.current.createOrder()).rejects.toThrow(); });
  await act(async () => { await expect(result.current.createOrder()).rejects.toThrow(); });
  expect(result.current.priceChange).toEqual({ shown: 3, charged: 30 });
  await act(async () => { expect(await result.current.createOrder()).toBe(ID); });
});

it('starts at once when the amounts agree to the cent, when the API sends none, or when the page shows none', async () => {
  for (const [shown, amount] of [[14, 14], [14.004, 14], [14, undefined], [undefined, 23]] as const) {
    vi.stubGlobal('fetch', vi.fn(async () => json(amount === undefined ? { id: ID } : { id: ID, amount })));
    const { result } = renderHook(() => usePayPalOrder({ getPayload: () => ({ type: 'donation', amount: 14 }), onPaid: vi.fn(), getShownAmount: () => shown }));
    await act(async () => { expect(await result.current.createOrder()).toBe(ID); });
    expect(result.current.error).toBeNull();
  }
});
