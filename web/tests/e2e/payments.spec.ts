import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Checkout, candle and donation flows. Nothing here reaches PayPal or the production API:
// every request that leaves localhost is answered by the mocks below or aborted.

type Reply = { status?: number; body: unknown };
type Call = { path: string; body: unknown };

const DEFAULT_REPLIES: Record<string, Reply[]> = {
  '/order/create_order': [{ body: { id: 'TESTORDER00000001', status: 'CREATED' } }],
  '/order/complete_order': [{ body: { id: 'TESTCAPTURE0000001', status: 'COMPLETED' } }],
  '/order/newOrder': [{ status: 201, body: 'Created' }],
  '/candle/lightACandle': [{ body: 'Success' }],
};

// A stand-in for the PayPal SDK, used only where a test needs a completed payment. Its button
// runs the page's own createOrder -> onApprove callbacks against the mocked API.
const FAKE_PAYPAL_SDK = `
window.paypal = {
  Buttons: function (opts) {
    return {
      isEligible: function () { return true; },
      render: function (container) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Test PayPal';
        b.onclick = function () {
          Promise.resolve(opts.createOrder({ paymentSource: 'paypal' }, {}))
            .then(function (id) { return opts.onApprove({ orderID: id }, {}); })
            .catch(function (err) { if (opts.onError) opts.onError(err); });
        };
        container.appendChild(b);
        return Promise.resolve();
      },
      close: function () { return Promise.resolve(); },
      updateProps: function () { return Promise.resolve(); }
    };
  }
};`;

async function mockNetwork(page: Page, { paypal = 'empty', replies = {} as Record<string, Reply[]> } = {}) {
  const calls: Call[] = [];
  const queues = { ...DEFAULT_REPLIES, ...replies };

  // Safety net first (routes registered later win): nothing else may leave localhost.
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
    (route) => route.abort(),
  );
  // The API: answer the payment and order calls, record what the page sent.
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname) && /^\/(order|candle)\//.test(url.pathname),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      calls.push({ path, body: route.request().postDataJSON() });
      const queue = queues[path] ?? [{ status: 404, body: { error: 'not mocked' } }];
      const reply = queue.length > 1 ? queue.shift()! : queue[0];
      await route.fulfill({
        status: reply.status ?? 200,
        contentType: 'application/json',
        body: typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body),
      });
    },
  );
  // The PayPal SDK: an empty script (no buttons), or the stand-in above.
  await page.route('https://www.paypal.com/sdk/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: paypal === 'fake' ? FAKE_PAYPAL_SDK : '' }),
  );
  return calls;
}

const CART = [
  { _id: '66eb4665c7e03262956c8d1d', name: 'Olive wood cross', price: 20, img: '/images/candle.jpg', color: 'brown', quantity: 2 },
];

async function seedCart(page: Page, lines: unknown[] = CART) {
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('nhc.cart.v1', value);
      sessionStorage.setItem('seeded', '1');
    }
  }, JSON.stringify(lines));
}

// Uncaught errors and hydration mismatches would otherwise pass silently.
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /hydrat/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('iframe').analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
}

async function fillContact(page: Page) {
  await page.getByLabel('First Name').fill('Maria');
  await page.getByLabel('Last Name').fill('Haddad');
  await page.getByLabel('Email', { exact: true }).fill('maria@example.com');
  await page.getByLabel('Confirmation Email').fill('maria@example.com');
  await page.getByLabel('Phone').fill('+972 52-123 4567');
  await page.getByLabel('Country').selectOption('IL');
  await page.getByLabel('Street Address').fill('1 Paulus VI St');
  await page.getByLabel('City').fill('Nazareth');
  await page.getByLabel('State/ Province').fill('North');
  await page.getByLabel('Postal/ Zip Code').fill('16000');
}

async function fillCandle(page: Page) {
  await page.getByText('Church of the Annunciation').click();
  await page.getByLabel('First Name').fill('Anna');
  await page.getByLabel('Last Name').fill('Smith');
  await page.getByLabel('Your Email').fill('anna@example.com');
  await page.getByLabel('Confirm Email').fill('anna@example.com');
  await page.getByLabel('Your Prayer').fill('For my family');
}

const currentStep = (page: Page) => page.locator('[aria-current="step"]');

test.describe('checkout', () => {
  test('an empty cart sends the visitor back to the shop', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/en/checkout');
    await expect(page.getByRole('heading', { name: 'Your Cart is Empty' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back To Shopping' })).toHaveAttribute('href', '/en/shop');

    await page.goto('/he/checkout');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'סל הקניות שלכם ריק' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'חזרה לקניות' })).toHaveAttribute('href', '/he/shop');
  });

  test('renders in English and Hebrew', async ({ page }) => {
    const errors = watchErrors(page);
    await mockNetwork(page);
    await seedCart(page);
    await page.goto('/en/checkout');
    await expect(page).toHaveTitle(/Checkout/);
    await expect(page.getByRole('heading', { name: 'Contact & Delivery Information' })).toBeVisible();
    await expect(page.getByText('Olive wood cross')).toBeVisible();
    await expect(page.getByTestId('order-total')).toHaveText('$41.00'); // 2 × $20, −10%, +$5 shipping
    await expect(currentStep(page)).toContainText('Your details');

    await page.goto('/he/checkout');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.getByRole('heading', { name: 'פרטי קשר ומשלוח' })).toBeVisible();
    await expect(page.getByLabel('מדינה', { exact: true })).toContainText('ישראל');
    expect(errors).toEqual([]);
  });

  test('shows inline errors until the details are valid', async ({ page }) => {
    await mockNetwork(page);
    await seedCart(page);
    await page.goto('/en/checkout');
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.locator('main').getByRole('alert')).toHaveText('Please correct the highlighted fields.');
    await expect(page.getByText('This field is required.')).toHaveCount(10);
    await expect(page.getByLabel('First Name')).toBeFocused();
    await expect(page.getByLabel('First Name')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Email', { exact: true }).fill('maria@example');
    await page.getByLabel('Confirmation Email').fill('someone@else.com');
    await expect(page.getByText('Enter a valid email address, for example name@example.com.')).toBeVisible();
    await expect(page.getByText("Emails don't match")).toBeVisible();
    await page.getByLabel('Phone').fill('call me');
    await expect(page.getByText('Enter a valid phone number, including the country code.')).toBeVisible();
    await expect(currentStep(page)).toContainText('Your details');
  });

  test('valid details lead to the order summary and PayPal', async ({ page }) => {
    const calls = await mockNetwork(page);
    await seedCart(page);
    await page.goto('/en/checkout');
    await fillContact(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(currentStep(page)).toContainText('Payment');
    await expect(page.getByRole('heading', { name: 'Payment Method' })).toBeVisible();
    await expect(page.getByText('Israel')).toBeVisible();
    await expect(page.getByTestId('order-total')).toHaveText('$41.00');
    // The empty PayPal stub never defines window.paypal: the page explains instead of breaking.
    await expect(page.getByText('PayPal could not be loaded.', { exact: false })).toBeVisible();
    expect(calls).toEqual([]);

    await page.getByRole('button', { name: 'Edit details' }).click();
    await expect(page.getByLabel('City')).toHaveValue('Nazareth');
  });

  test('a completed payment saves the order and empties the cart', async ({ page }) => {
    const calls = await mockNetwork(page, { paypal: 'fake' });
    await seedCart(page);
    await page.goto('/en/checkout');
    await fillContact(page);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await page.getByRole('button', { name: 'Test PayPal' }).click();

    await expect(page.getByRole('heading', { name: 'Thank You!' })).toBeVisible();
    await expect(page.getByText('A receipt has been sent to your email address.')).toBeVisible();
    await expect(page.getByText('Payment reference: TESTCAPTURE0000001')).toBeVisible();
    expect(calls).toEqual([
      {
        path: '/order/create_order',
        body: { type: 'order', items: [{ _id: '66eb4665c7e03262956c8d1d', quantity: 2 }] },
      },
      { path: '/order/complete_order', body: { order_id: 'TESTORDER00000001' } },
      {
        path: '/order/newOrder',
        body: {
          firstName: 'Maria',
          lastName: 'Haddad',
          phone: '+972 52-123 4567',
          email: 'maria@example.com',
          street: '1 Paulus VI St',
          city: 'Nazareth',
          state: 'North',
          postal: '16000',
          country: 'Israel',
          totalPrice: 41,
          products: [{ productID: '66eb4665c7e03262956c8d1d', productName: 'Olive wood cross', quantity: 2, color: 'brown' }],
        },
      },
    ]);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('nhc.cart.v1'))).toBe('[]');
  });

  test('PayPal errors are explained in the visitor language', async ({ page }) => {
    await mockNetwork(page, {
      paypal: 'fake',
      replies: { '/order/create_order': [{ status: 500, body: { error: 'boom' } }] },
    });
    await seedCart(page);
    await page.goto('/he/checkout');
    await page.getByLabel('שם פרטי').fill('Maria');
    await page.getByLabel('שם משפחה').fill('Haddad');
    await page.getByLabel('דוא״ל', { exact: true }).fill('maria@example.com');
    await page.getByLabel('אימות דוא״ל').fill('maria@example.com');
    await page.getByLabel('טלפון').fill('+972521234567');
    await page.getByLabel('מדינה', { exact: true }).selectOption('IL');
    await page.getByLabel('רחוב ומספר בית').fill('Paulus VI 1');
    await page.getByLabel('עיר').fill('נצרת');
    await page.getByLabel('מדינה / מחוז').fill('צפון');
    await page.getByLabel('מיקוד').fill('16000');
    await page.getByRole('button', { name: 'המשך לתשלום' }).click();
    await page.getByRole('button', { name: 'Test PayPal' }).click();
    await expect(page.locator('main').getByRole('alert')).toHaveText('לא הצלחנו להתחיל את התשלום. נסו שוב.');
  });
});

test.describe('candle', () => {
  test('renders in English and Hebrew', async ({ page }) => {
    const errors = watchErrors(page);
    await mockNetwork(page);
    await page.goto('/en/candle');
    await expect(page).toHaveTitle(/Light a candle in Nazareth/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A flame for every prayer');
    await expect(page.getByRole('heading', { name: 'How to light a candle?' })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(2);
    await expect(page.getByRole('radio', { name: 'Church of the Annunciation' })).toHaveAttribute('name', 'church');
    await expect(page.getByRole('radio', { name: 'Greek Orthodox Church' })).toHaveAttribute('name', 'church');
    await expect(page.getByText('To light a candle: $3.00')).toBeVisible();

    await page.goto('/he/candle');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'איך מדליקים נר?' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'כנסיית הבשורה' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('asks for a church and every field', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/en/candle');
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
    await expect(page.getByText('Please select a church.')).toBeVisible();
    await expect(page.getByText('This field is required.')).toHaveCount(5);
    await expect(page.getByRole('radio', { name: 'Church of the Annunciation' })).toBeFocused();

    await page.getByText('Greek Orthodox Church').click();
    await expect(page.getByText('Please select a church.')).toBeHidden();
    await expect(page.getByRole('radio', { name: 'Greek Orthodox Church' })).toBeChecked();
  });

  test('valid details lead to the $3 summary and PayPal', async ({ page }) => {
    const calls = await mockNetwork(page);
    await page.goto('/en/candle');
    await fillCandle(page);
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Order Summary' })).toBeVisible();
    await expect(page.getByTestId('candle-total')).toHaveText('$3.00');
    await expect(page.getByText('For my family')).toBeVisible();
    await expect(currentStep(page)).toContainText('Payment');
    expect(calls).toEqual([]);
  });

  test('a completed payment sends the candle request, and a failed save can be retried', async ({ page }) => {
    const calls = await mockNetwork(page, {
      paypal: 'fake',
      replies: { '/candle/lightACandle': [{ status: 500, body: { error: 'down' } }, { body: 'Success' }] },
    });
    await page.goto('/en/candle');
    await fillCandle(page);
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
    await page.getByRole('button', { name: 'Test PayPal' }).click();

    await expect(page.getByRole('heading', { name: 'Thank You!' })).toBeVisible();
    await expect(page.locator('main').getByRole('alert')).toContainText('we could not save your details');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('main').getByRole('alert')).toBeHidden();
    await expect(page.getByText('A receipt has been sent to your email address.')).toBeVisible();

    const expected = { firstName: 'Anna', lastName: 'Smith', email: 'anna@example.com', prayer: 'Annunciation church, For my family' };
    expect(calls).toEqual([
      { path: '/order/create_order', body: { type: 'candle' } },
      { path: '/order/complete_order', body: { order_id: 'TESTORDER00000001' } },
      { path: '/candle/lightACandle', body: expected },
      { path: '/candle/lightACandle', body: expected },
    ]);
  });
});

test.describe('donate', () => {
  test('renders in English and Hebrew', async ({ page }) => {
    const errors = watchErrors(page);
    await mockNetwork(page);
    await page.goto('/en/donate');
    await expect(page).toHaveTitle(/Donate/);
    await expect(page.getByRole('heading', { name: 'Make a donation' })).toBeVisible();
    await expect(page.getByRole('radio', { name: '$25' })).toBeChecked();

    await page.goto('/he/donate');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'תרומה', level: 2, exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'סכום אחר' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('checks the name and keeps the amount between $1 and $5,000', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/en/donate');
    await page.getByText('Other amount').click();
    await page.getByLabel('Amount in US dollars').fill('6000');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByText('This field is required.')).toBeVisible();
    await expect(page.getByText('Enter an amount between $1.00 and $5,000.00.')).toBeVisible();
    await expect(page.getByLabel('Your name')).toBeFocused();

    await page.getByLabel('Amount in US dollars').fill('0.5');
    await expect(page.getByText('Enter an amount between $1.00 and $5,000.00.')).toBeVisible();
    await page.getByLabel('Amount in US dollars').fill('40');
    await expect(page.getByText('Enter an amount between', { exact: false })).toBeHidden();
  });

  test('a valid gift reaches PayPal and ends with a thank-you', async ({ page }) => {
    const calls = await mockNetwork(page, { paypal: 'fake' });
    await page.goto('/en/donate');
    await page.getByLabel('Your name').fill('Anna');
    await page.getByText('Other amount').click();
    await page.getByLabel('Amount in US dollars').fill('40');
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page.getByRole('heading', { name: 'Your donation' })).toBeVisible();
    await expect(page.getByTestId('donation-total')).toHaveText('$40.00');
    await page.getByRole('button', { name: 'Test PayPal' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for your donation!' })).toBeVisible();
    expect(calls).toEqual([
      { path: '/order/create_order', body: { type: 'donation', amount: 40 } },
      { path: '/order/complete_order', body: { order_id: 'TESTORDER00000001' } },
    ]);
  });
});

test.describe('accessibility', () => {
  for (const locale of ['en', 'he']) {
    test(`payment pages have no serious violations (${locale})`, async ({ page }) => {
      await mockNetwork(page);
      for (const path of ['checkout', 'candle', 'donate']) {
        await page.goto(`/${locale}/${path}`);
        await expect(page.locator('main h2').first()).toBeVisible();
        await expectNoSeriousA11yIssues(page);
      }
      await seedCart(page);
      await page.goto(`/${locale}/checkout`);
      await expect(page.locator('form')).toBeVisible();
      await expectNoSeriousA11yIssues(page);
    });
  }

  test('steps 2 and 3 have no serious violations', async ({ page }) => {
    await mockNetwork(page, { paypal: 'fake' });
    await page.goto('/en/candle');
    await fillCandle(page);
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Test PayPal' })).toBeVisible();
    await expectNoSeriousA11yIssues(page);
    await page.getByRole('button', { name: 'Test PayPal' }).click();
    await expect(page.getByRole('heading', { name: 'Thank You!' })).toBeVisible();
    await expectNoSeriousA11yIssues(page);
  });

  test('Arabic pages hydrate without mismatches', async ({ page }) => {
    const errors = watchErrors(page);
    await mockNetwork(page);
    for (const path of ['candle', 'donate']) {
      await page.goto(`/ar/${path}`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('main h2').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});
