/**
 * Build marker. Every stub module that holds logic carries this string in a message that
 * survives minification, so app/src/stubAbsent.test.ts can prove the production build does not
 * reach the stub. Test-only from #83: nothing but engineClient.ts may import the stub.
 */
export const STUB_MARKER = "__CLEARLANE_STUB__";
