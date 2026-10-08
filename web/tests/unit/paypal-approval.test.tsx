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
