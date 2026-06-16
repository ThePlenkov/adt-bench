import { describe, it, expect, afterEach } from 'vitest';
import { startMockAdt, type MockServer } from './server.js';

let server: MockServer | null = null;
afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
});

describe('mock-adt-server', () => {
  it('serves the discovery endpoint', async () => {
    server = await startMockAdt();
    const res = await fetch(server.url + '/sap/bc/adt/discovery');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<app:service');
  });

  it('issues a CSRF token when X-CSRF-Token: Fetch is sent on GET', async () => {
    server = await startMockAdt();
    const res = await fetch(server.url + '/sap/bc/adt/discovery', {
      headers: { 'x-csrf-token': 'Fetch' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-csrf-token')).toMatch(/^csrf-/);
  });

  it('search returns matching classes', async () => {
    server = await startMockAdt({
      initialClasses: [
        { name: 'ZCL_HELLO', source: 'class zcl_hello definition.' },
        { name: 'ZCL_OTHER', source: 'class zcl_other definition.' },
      ],
    });
    const res = await fetch(
      server.url + '/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=ZCL_HELLO&maxResults=10'
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('ZCL_HELLO');
    expect(text).not.toContain('ZCL_OTHER');
  });

  it('class create -> lock -> write -> unlock -> activate', async () => {
    server = await startMockAdt();
    const base = server.url;

    // create
    let res = await fetch(base + '/sap/bc/adt/oo/classes', {
      method: 'POST',
      headers: { 'content-type': 'application/vnd.sap.adt.oo.classes.v2+xml' },
      body: '<?xml version="1.0"?><class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:name>ZCL_DEMO</adtcore:name><adtcore:packageName>$TMP</adtcore:packageName></class:abapClass>',
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('location')).toBe('/sap/bc/adt/oo/classes/zcl_demo');

    // lock
    res = await fetch(base + '/sap/bc/adt/oo/classes/zcl_demo?_action=LOCK&accessMode=MODIFY', {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const lockXml = await res.text();
    const handle = lockXml.match(/<LOCK_HANDLE>([^<]+)/)?.[1];
    expect(handle).toBeDefined();

    // write
    res = await fetch(
      base + `/sap/bc/adt/oo/classes/zcl_demo/source/main?lockHandle=${handle}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: 'class zcl_demo definition.\nendclass.',
      }
    );
    expect(res.status).toBe(204);

    // unlock
    res = await fetch(
      base + `/sap/bc/adt/oo/classes/zcl_demo?_action=UNLOCK&lockHandle=${handle}`,
      { method: 'POST' }
    );
    expect(res.status).toBe(204);

    // activate
    res = await fetch(base + '/sap/bc/adt/activation?method=activate&preauditRequested=true', {
      method: 'POST',
      headers: { 'content-type': 'application/xml' },
      body: '<?xml version="1.0"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_demo" adtcore:type="CLAS" adtcore:name="ZCL_DEMO"/></adtcore:objectReferences>',
    });
    expect(res.status).toBe(200);
    const actXml = await res.text();
    expect(actXml).toContain('activationExecuted="true"');
    expect(actXml).toContain('ZCL_DEMO');

    // get source
    res = await fetch(base + '/sap/bc/adt/oo/classes/zcl_demo/source/main');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('zcl_demo');

    // state check via __mock/state
    res = await fetch(base + '/__mock/state');
    const st = (await res.json()) as { classes: { name: string; activated: boolean }[] };
    expect(st.classes.find((c) => c.name === 'ZCL_DEMO')?.activated).toBe(true);
  });

  it('PUT without a valid lock handle returns 409', async () => {
    server = await startMockAdt({
      initialClasses: [{ name: 'ZCL_X', source: 'class zcl_x definition.' }],
    });
    const res = await fetch(
      server.url + '/sap/bc/adt/oo/classes/zcl_x/source/main?lockHandle=bogus',
      {
        method: 'PUT',
        body: 'changed',
      }
    );
    expect(res.status).toBe(409);
  });

  it('stats endpoint reports per-endpoint call counts', async () => {
    server = await startMockAdt();
    await fetch(server.url + '/sap/bc/adt/discovery');
    await fetch(server.url + '/sap/bc/adt/discovery');
    const res = await fetch(server.url + '/__mock/stats');
    const stats = (await res.json()) as { by_endpoint: Record<string, number> };
    expect(stats.by_endpoint['/sap/bc/adt/discovery']).toBe(2);
  });

  it('reset wipes state', async () => {
    server = await startMockAdt({
      initialClasses: [{ name: 'ZCL_KEEP', source: 'x' }],
    });
    let res = await fetch(server.url + '/__mock/state');
    let st = (await res.json()) as { classes: { name: string }[] };
    expect(st.classes).toHaveLength(1);
    await fetch(server.url + '/__mock/reset', { method: 'POST' });
    res = await fetch(server.url + '/__mock/state');
    st = (await res.json()) as { classes: { name: string }[] };
    expect(st.classes).toHaveLength(0);
  });
});
