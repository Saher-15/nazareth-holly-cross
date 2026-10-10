import { it, expect, vi, afterAll } from 'vitest';
vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../model/product.js', async () => (await import('./helpers/fakes.js')).fakeModule('Product'));
vi.mock('../model/order.js', async () => (await import('./helpers/fakes.js')).fakeModule('Order'));
vi.mock('../model/candle.js', async () => (await import('./helpers/fakes.js')).fakeModule('Candle'));
vi.mock('../services/emailService.js', () => ({sendMail: vi.fn(async () => true), SENDER: {}}));
const { fakes } = await import('./helpers/fakes.js');
const { PASSWORD, seedAdmin, freshIp, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { clearAccessTokenCache } = await import('../services/paypalService.js');
const { http, close } = startClient(createApp());
afterAll(close);
it('consumes a TOTP once when login requests race', async () => {
  fakes.Admin.reset(); fakes.AdminSession.reset();
  const {encryptSecret, newSecret, totp} = await import('../services/totp.js');
  const secret = newSecret();
  seedAdmin({username:'race',role:'owner',totpEnabled:true,totpSecretEnc:encryptSecret(secret),totpLastStep:-1});
  const code=totp(secret);
  const results=await Promise.all([1,2].map(()=>http.post('/admin/auth/login').set('X-Forwarded-For',freshIp()).send({username:'race',password:PASSWORD,totp:code})));
  expect(results.map(r=>r.status).sort()).toEqual([200,401]);
  expect(fakes.AdminSession.docs).toHaveLength(1);
});
it.each([
  ['disabled', {disabled:true}],
  ['locked', {lockedUntil:new Date(Date.now()+600000)}],
  ['two-factor', {totpEnabled:true}],
  ['viewer', {role:'viewer'}],
])('removed legacy login refuses %s account and product deletion', async (_, fields) => {
  fakes.Admin.reset(); fakes.Product.reset();
  seedAdmin({username:'review', ...fields});
  const [product] = fakes.Product.seed([{name:'Test',price:10,img:'test'}]);
  const login = await http.post('/admin/login').set('X-Forwarded-For', freshIp()).send({username:'review',password:PASSWORD});
  expect(login.status).toBe(404);
  const deleted = await http.delete(`/admin/products/${product._id}`).set('X-Forwarded-For',freshIp()).set('Authorization',`Bearer ${login.body.token}`);
  expect(deleted.status).toBe(401);
  expect(fakes.Product.docs).toHaveLength(1);
});
it('retains a pending nested capture without claiming payment success', async () => {
  fakes.Payment.reset(); clearAccessTokenCache();
  const id = 'ABCDEFGHIJ0123456';
  fakes.Payment.seed([{paypalOrderId:id,type:'donation',amount:25,currency:'USD',status:'created'}]);
  global.fetch = vi.fn(async url => ({ok:true,status:200,json:async () => String(url).includes('/oauth2/token')
    ? {access_token:'test-token'}
    : {id,status:'COMPLETED',purchase_units:[{amount:{currency_code:'USD',value:'25.00'},payments:{captures:[{id:'CAPTURE',status:'PENDING',amount:{currency_code:'USD',value:'25.00'}}]}}]}}));
  const result = await http.post('/order/complete_order').set('X-Forwarded-For',freshIp()).send({order_id:id});
  expect(result.status).toBe(202);
  expect(result.body.status).toBe('PENDING');
  expect(fakes.Payment.docs[0].status).toBe('created');
});
it('fulfils the immutable approved quote after a catalog price changes', async () => {
  fakes.Payment.reset(); fakes.Product.reset(); fakes.Order.reset(); clearAccessTokenCache();
  const id = 'ABCDEFGHIJ0123456';
  const [product] = fakes.Product.seed([{name:'Olive oil',price:10,img:'test',stock:null}]);
  const paid = {id,status:'COMPLETED',purchase_units:[{amount:{currency_code:'USD',value:'14.00'},payments:{captures:[{status:'COMPLETED',amount:{currency_code:'USD',value:'14.00'}}]}}]};
  global.fetch = vi.fn(async url => ({ok:true,status:200,json:async () => String(url).includes('/oauth2/token') ? {access_token:'test-token'} : String(url).endsWith('/v2/checkout/orders') ? {id,status:'CREATED'} : paid}));
  const created = await http.post('/order/create_order').set('X-Forwarded-For',freshIp()).send({type:'order',items:[{_id:product._id,quantity:1}]});
  expect(created.body.amount).toBe(14);
  await fakes.Product.updateOne({_id:product._id},{price:20});
  const result = await http.post('/order/newOrder').set('X-Forwarded-For',freshIp()).send({firstName:'A',lastName:'B',phone:'123456789',email:'a@example.com',street:'Street',city:'City',state:'State',postal:'12345',country:'IL',products:[{productID:product._id,quantity:1}],paypalOrderId:id});
  expect(result.status).toBe(201);
  expect(fakes.Order.docs).toHaveLength(1);
  expect(fakes.Order.docs[0].totalPrice).toBe(14);
  expect(fakes.Order.docs[0].products[0].productName).toBe('Olive oil');
});

it('repairs a lost capture answer and fulfils the server draft without charging again', async () => {
  fakes.Payment.reset(); fakes.Product.reset(); fakes.Order.reset(); clearAccessTokenCache();
  const id = 'REPAIR00000000001';
  const [product] = fakes.Product.seed([{name:'Cross',price:10,img:'test',stock:null}]);
  const draft = {firstName:'A',lastName:'B',phone:'123456789',email:'a@example.com',street:'Street',city:'City',state:'State',postal:'12345',country:'IL'};
  const paid = {id,status:'COMPLETED',purchase_units:[{amount:{currency_code:'USD',value:'14.00'},payments:{captures:[{status:'COMPLETED',amount:{currency_code:'USD',value:'14.00'}}]}}]};
  global.fetch = vi.fn(async (url, opts) => {
    if (String(url).endsWith('/capture')) throw new Error('Repair must never charge');
    return {ok:true,status:200,json:async () => String(url).includes('/oauth2/token') ? {access_token:'test-token'} : opts?.method === 'GET' ? paid : {id,status:'CREATED'}};
  });
  const created = await http.post('/order/create_order').set('X-Forwarded-For',freshIp()).send({type:'order',items:[{_id:product._id,quantity:1}],fulfilment:draft});
  expect(created.status).toBe(200);
  const { repairPayments } = await import('../services/paymentRepair.js');
  expect(await repairPayments()).toMatchObject([{status:'COMPLETED',repaired:false}]);
  expect(fakes.Order.docs).toHaveLength(0);
  expect(await repairPayments({apply:true})).toMatchObject([{status:'COMPLETED',repaired:true}]);
  expect(fakes.Order.docs).toHaveLength(1);
  expect(fakes.Payment.docs[0]).toMatchObject({status:'captured',captureVerified:true});
  expect(fakes.Payment.docs[0].fulfilment).toBeUndefined();
  expect(await repairPayments({apply:true})).toEqual([]);
  expect(fakes.Order.docs).toHaveLength(1);
});

it('does not promote historical unverified captured rows without asking PayPal', async () => {
  const {capturedPayment} = await import('../services/payments.js');
  fakes.Payment.reset();
  fakes.Payment.seed([{paypalOrderId:'HISTORICAL0000001',type:'donation',amount:25,status:'captured'}]);
  expect(await capturedPayment('HISTORICAL0000001')).toBeNull();
});

it('rejects excessive or pending capture amounts as proof of payment', async () => {
  const {verifiedCaptureStatus,assertPaid} = await import('../services/paypalService.js');
  clearAccessTokenCache();
  const capture = {status:'COMPLETED',purchase_units:[{amount:{currency_code:'USD',value:'25.00'},payments:{captures:[{status:'COMPLETED',amount:{currency_code:'USD',value:'30.00'}}]}}]};
  expect(() => verifiedCaptureStatus(capture,25)).toThrow('does not match');
  global.fetch = vi.fn(async url => ({ok:true,status:200,json:async () => String(url).includes('/oauth2/token') ? {access_token:'test-token'} : capture}));
  await expect(assertPaid('EXCESSIVE00000001',25)).rejects.toMatchObject({status:402});
});

it('fulfils once when the server recovers the order and the browser then sends it too (duplicate fulfilment)', async () => {
  fakes.Payment.reset(); fakes.Product.reset(); fakes.Order.reset(); clearAccessTokenCache();
  const id = 'DUPLICATE00000001';
  const [product] = fakes.Product.seed([{name:'Rosary',price:10,img:'test',stock:null}]);
  const draft = {firstName:'A',lastName:'B',phone:'123456789',email:'a@example.com',street:'Street',city:'City',state:'State',postal:'12345',country:'IL'};
  const paid = {id,status:'COMPLETED',purchase_units:[{amount:{currency_code:'USD',value:'14.00'},payments:{captures:[{status:'COMPLETED',amount:{currency_code:'USD',value:'14.00'}}]}}]};
  global.fetch = vi.fn(async url => ({ok:true,status:200,json:async () => String(url).includes('/oauth2/token') ? {access_token:'test-token'} : String(url).endsWith('/v2/checkout/orders') ? {id,status:'CREATED'} : paid}));
  await http.post('/order/create_order').set('X-Forwarded-For',freshIp()).send({type:'order',items:[{_id:product._id,quantity:1}],fulfilment:draft});
  const captured = await http.post('/order/complete_order').set('X-Forwarded-For',freshIp()).send({order_id:id});
  expect(captured.status).toBe(200);
  expect(fakes.Order.docs).toHaveLength(1); // the server fulfilled from the stored draft
  const browser = await http.post('/order/newOrder').set('X-Forwarded-For',freshIp()).send({...draft,products:[{productID:product._id,quantity:1}],paypalOrderId:id});
  expect(browser.status).toBe(409);
  expect(browser.body.error).toMatch(/already used/); // the browser counts this as "saved" (pendingFulfilment classify)
  expect(fakes.Order.docs).toHaveLength(1);
  expect(fakes.Payment.docs[0].fulfilment).toBeUndefined(); // the draft (personal data) is cleared after fulfilment
  expect(global.fetch.mock.calls.filter(([u]) => String(u).endsWith('/capture'))).toHaveLength(1); // charged once
});

it('refuses a cart that differs from the paid quote instead of re-pricing it', async () => {
  fakes.Payment.reset(); fakes.Product.reset(); fakes.Order.reset(); clearAccessTokenCache();
  const id = 'CARTCHANGED000001';
  const [a, b] = fakes.Product.seed([{name:'One',price:10,img:'t',stock:null},{name:'Two',price:10,img:'t',stock:null}]);
  const paid = {id,status:'COMPLETED',purchase_units:[{payments:{captures:[{status:'COMPLETED',amount:{currency_code:'USD',value:'14.00'}}]}}]};
  global.fetch = vi.fn(async url => ({ok:true,status:200,json:async () => String(url).includes('/oauth2/token') ? {access_token:'test-token'} : String(url).endsWith('/v2/checkout/orders') ? {id,status:'CREATED'} : paid}));
  await http.post('/order/create_order').set('X-Forwarded-For',freshIp()).send({type:'order',items:[{_id:a._id,quantity:1}]});
  const result = await http.post('/order/newOrder').set('X-Forwarded-For',freshIp()).send({firstName:'A',lastName:'B',phone:'1',email:'a@example.com',street:'S',city:'C',state:'S',postal:'1',country:'IL',products:[{productID:b._id,quantity:1}],paypalOrderId:id});
  expect(result.status).toBe(409);
  expect(fakes.Order.docs).toHaveLength(0);
});

it('verifiedCaptureStatus: exact USD total of every capture, pending stays pending, no server price means no charge', async () => {
  const { verifiedCaptureStatus } = await import('../services/paymentCapture.js');
  const order = (...caps) => ({status:'COMPLETED',purchase_units:[{payments:{captures:caps.map(([status,value,currency_code='USD']) => ({status,amount:{currency_code,value}}))}}]});
  expect(verifiedCaptureStatus(order(['COMPLETED','10.00'],['COMPLETED','4.00']), 14)).toBe('COMPLETED');
  expect(verifiedCaptureStatus(order(['COMPLETED','10.00'],['PENDING','4.00']), 14)).toBe('PENDING');
  expect(verifiedCaptureStatus(order(['COMPLETED','10.00'],['DECLINED','4.00']), 14)).toBe('NOT_COMPLETED');
  expect(verifiedCaptureStatus({...order(['COMPLETED','14.00']), status:'APPROVED'}, 14)).toBe('NOT_COMPLETED');
  expect(() => verifiedCaptureStatus(order(['COMPLETED','13.99']), 14)).toThrow('does not match');
  expect(() => verifiedCaptureStatus(order(['COMPLETED','14.00','EUR']), 14)).toThrow('does not match');
  expect(() => verifiedCaptureStatus(order(['COMPLETED','14.000']), 14)).toThrow('does not match');
  expect(() => verifiedCaptureStatus(order(['COMPLETED','14.00']), undefined)).toThrow('No priced payment');
});
